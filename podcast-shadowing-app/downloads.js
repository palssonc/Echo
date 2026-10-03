const EchoDownloads = (() => {
  const byId = id => state.downloads.get(id);
  const active = id => state.downloadJobs.get(id);
  const hasFile = item => Boolean(item && item.blob && item.blob.size);

  async function load(records) {
    const items = new Map();
    let root;
    for (const record of records) {
      if (record.storage === 'opfs') {
        try {
          root ||= await navigator.storage.getDirectory();
          const handle = await root.getFileHandle(record.fileName);
          record.blob = await handle.getFile();
          if (!record.blob.size) record.missing = true;
        } catch {
          record.missing = true;
        }
      }
      items.set(record.id, record);
    }
    return items;
  }

  function progressText(job) {
    if (!job.loaded) return 'Connecting…';
    if (job.total) return Math.min(99, Math.round(job.loaded / job.total * 100)) + '% · ' + formatBytes(job.loaded) + ' of ' + formatBytes(job.total);
    return formatBytes(job.loaded) + ' downloaded';
  }

  function render() {
    const jobs = [...state.downloadJobs.values()];
    const saved = [...state.downloads.values()].sort((a, b) => b.downloadedAt - a.downloadedAt);
    const list = $('#downloadLibrary');
    $('#downloadCount').textContent = saved.length;
    $('#downloadNavCount').textContent = saved.length + jobs.length;
    $('#downloadStorage').textContent = saved.length ?
      formatBytes(saved.reduce((sum, item) => sum + (item.size || item.blob?.size || 0), 0)) + ' stored on this device' :
      'No episode audio stored yet';
    $('#emptyDownloads').hidden = saved.length + jobs.length > 0;

    const pendingHtml = jobs.map(job => {
      const pct = job.total ? Math.min(99, Math.round(job.loaded / job.total * 100)) : 0;
      return '<article class="download-card download-pending">' +
        '<div class="download-art">' + art(job.episode.artwork, job.episode.showName) + '</div>' +
        '<div class="download-info"><div class="eyebrow">DOWNLOADING</div>' +
        '<h3>' + esc(job.episode.title) + '</h3><p>' + esc(job.episode.showName) + '</p>' +
        '<small>' + esc(progressText(job)) + '</small>' +
        '<progress max="100" value="' + pct + '" aria-label="Download progress"></progress></div>' +
        '<div class="download-actions"><button class="text-button" data-cancel-download="' + esc(job.id) + '">Cancel</button></div></article>';
    }).join('');

    const savedHtml = saved.map(item => {
      const ep = item.episode;
      const playable = hasFile(item);
      return '<article class="download-card">' +
        '<div class="download-art">' + art(ep.artwork, ep.showName) + '</div>' +
        '<div class="download-info"><div class="offline-label">' + (playable ? 'SAVED ON THIS DEVICE' : 'FILE UNAVAILABLE') + '</div>' +
        '<h3>' + esc(ep.title) + '</h3><p>' + esc(ep.showName) +
        (ep.duration ? ' · ' + fmt(ep.duration) : '') + '</p><small>' +
        formatBytes(item.size || item.blob?.size || 0) + ' · Saved ' +
        new Date(item.downloadedAt).toLocaleDateString() + '</small></div>' +
        '<div class="download-actions">' +
        (playable ? '<button class="primary-button" data-play-download="' + esc(item.id) + '">▶ Play downloaded</button>' : '') +
        '<button class="text-button" data-remove-download="' + esc(item.id) + '">Remove</button>' +
        '</div></article>';
    }).join('');

    list.innerHTML = pendingHtml + savedHtml;
    list.querySelectorAll('[data-play-download]').forEach(button => {
      button.onclick = () => {
        const item = byId(button.dataset.playDownload);
        if (hasFile(item)) playEpisode(item.episode);
      };
    });
    list.querySelectorAll('[data-remove-download]').forEach(button => {
      button.onclick = () => remove(button.dataset.removeDownload);
    });
    list.querySelectorAll('[data-cancel-download]').forEach(button => {
      button.onclick = () => active(button.dataset.cancelDownload)?.controller.abort();
    });
  }

  function updateButtons() {
    $$('[data-download]').forEach(button => {
      const id = button.dataset.download;
      const compact = button.classList.contains('episode-download');
      const job = active(id);
      const item = byId(id);
      button.disabled = false;
      button.textContent = job ? '↓ ' + progressText(job) :
        hasFile(item) ? (compact ? '✓ Downloaded' : '✓ Saved offline · View downloads') :
        (compact ? '↓ Download' : '↓ Download episode for offline listening');
    });
    $('#downloadNavCount').textContent = state.downloads.size + state.downloadJobs.size;
    if ($('#downloadsView').classList.contains('active')) render();
  }

  async function remove(id) {
    const item = byId(id);
    if (!item) return;
    try {
      await del('downloads', id);
      if (item.storage === 'opfs' && item.fileName) {
        try {
          const root = await navigator.storage.getDirectory();
          await root.removeEntry(item.fileName);
        } catch {}
      }
      state.downloads.delete(id);
      if (state.current?.id === id) state.currentDownloaded = false;
      updateButtons();
      render();
      if (state.current?.id === id) renderPlayer();
      toast('Download removed');
    } catch {
      toast('Could not remove this download.');
    }
  }

  async function saveResponse(response, job) {
    const mediaType = response.headers.get('content-type') || 'audio/mpeg';
    if (/^(text\/html|application\/(?:json|xml))/i.test(mediaType)) {
      throw new Error('The audio link returned a webpage instead of an episode.');
    }
    job.total = Number(response.headers.get('content-length')) || 0;
    const stream = response.body;
    const markChunk = chunk => {
      job.loaded += chunk.byteLength;
      if (Date.now() - job.lastRender > 250) {
        job.lastRender = Date.now();
        updateButtons();
      }
    };
    if (stream && navigator.storage?.getDirectory) {
      let root, fileName, handle, writer;
      try {
        root = await navigator.storage.getDirectory();
        fileName = 'echo-' + uid() + '.audio';
        handle = await root.getFileHandle(fileName, {create: true});
        writer = await handle.createWritable();
      } catch {
        if (root && fileName) {
          try { await root.removeEntry(fileName); } catch {}
        }
      }
      if (writer) {
        try {
          if (typeof TransformStream === 'function' && stream.pipeThrough) {
            const counted = stream.pipeThrough(new TransformStream({
              transform(chunk, controller) {
                markChunk(chunk);
                controller.enqueue(chunk);
              }
            }));
            await counted.pipeTo(writer, {preventClose: true, signal: job.controller.signal});
          } else {
            const reader = stream.getReader();
            while (true) {
              const {done, value} = await reader.read();
              if (done) break;
              await writer.write(value);
              markChunk(value);
            }
          }
          await writer.close();
          const blob = await handle.getFile();
          return {blob, size: blob.size, storage: 'opfs', fileName};
        } catch (error) {
          try { await writer.abort(); } catch {}
          try { await root.removeEntry(fileName); } catch {}
          throw error;
        }
      }
    }

    if (stream && typeof TransformStream === 'function') {
      const counted = stream.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          markChunk(chunk);
          controller.enqueue(chunk);
        }
      }));
      const blob = await new Response(counted, {headers: {'Content-Type': mediaType}}).blob();
      return {blob, size: blob.size, storage: 'indexeddb'};
    }

    const blob = await response.blob();
    job.loaded = blob.size;
    return {blob, size: blob.size, storage: 'indexeddb'};
  }

  async function download(episode) {
    if (!episode?.url) return;
    if (active(episode.id) || hasFile(byId(episode.id))) {
      if ($('#episodesDialog').open) $('#episodesDialog').close();
      nav('downloads');
      return;
    }
    const job = {
      id: episode.id,
      episode,
      loaded: 0,
      total: 0,
      lastRender: 0,
      controller: new AbortController()
    };
    state.downloadJobs.set(episode.id, job);
    updateButtons();
    let file;
    try {
      const response = await fetch(episode.url, {mode: 'cors', signal: job.controller.signal});
      if (!response.ok) throw new Error('The audio server returned HTTP ' + response.status + '.');
      file = await saveResponse(response, job);
      if (!file.size) throw new Error('The audio server returned an empty file.');
      if (job.controller.signal.aborted) throw new DOMException('Download cancelled', 'AbortError');
      const record = {
        id: episode.id,
        episode,
        size: file.size,
        storage: file.storage,
        downloadedAt: Date.now()
      };
      if (file.fileName) record.fileName = file.fileName;
      else record.blob = file.blob;
      try {
        await put('downloads', record);
      } catch (error) {
        if (file.fileName) {
          try { await (await navigator.storage.getDirectory()).removeEntry(file.fileName); } catch {}
        }
        throw error;
      }
      state.downloads.set(episode.id, {...record, blob: file.blob});
      if (state.current?.id === episode.id) {
        state.currentDownloaded = true;
        renderPlayer();
      }
      toast('Saved for offline listening · ' + formatBytes(file.size));
    } catch (error) {
      if (file?.fileName && !state.downloads.has(episode.id)) {
        try { await (await navigator.storage.getDirectory()).removeEntry(file.fileName); } catch {}
      }
      if (error.name === 'AbortError') toast('Download cancelled');
      else if (error.name === 'QuotaExceededError') toast('Not enough device storage for this episode.');
      else if (error instanceof TypeError) toast(navigator.onLine ? 'This podcast host does not allow browser downloads.' : 'Connect to the internet and try again.');
      else toast(error.message || 'Download failed. Try again.');
    } finally {
      state.downloadJobs.delete(episode.id);
      updateButtons();
      render();
    }
  }

  return {load, render, updateButtons, download, remove};
})();

