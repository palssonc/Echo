const EchoAudio = (() => {
  let savePositionTimer;

  function bind(element) {
    element.addEventListener('play', () => {
      if (element !== audio) return;
      updatePlayIcons();
      EchoCapture.start();
      if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
      $('#playingDot').hidden = false;
    });
    element.addEventListener('pause', () => {
      if (element !== audio) return;
      updatePlayIcons();
      EchoCapture.status();
      if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused';
    });
    element.addEventListener('timeupdate', () => {
      if (element !== audio) return;
      const player = $('#playerContent');
      const seek = player.querySelector('.scrubber');
      if (seek && Number.isFinite(audio.duration) && !seek.matches(':active')) {
        seek.value = audio.currentTime / audio.duration * 100;
      }
      if (player.querySelector('.current-time')) player.querySelector('.current-time').textContent = fmt(audio.currentTime);
      if (player.querySelector('.total-time')) player.querySelector('.total-time').textContent = fmt(audio.duration);
      if ($('#miniPlayer .mini-time')) $('#miniPlayer .mini-time').textContent = fmt(audio.currentTime);
      if (state.activeClip && audio.currentTime - state.activeClip.start >= 45) finishClip(true);
      if (!state.current) return;
      clearTimeout(savePositionTimer);
      savePositionTimer = setTimeout(() => put('positions', {
        id: state.current.id, time: audio.currentTime
      }).catch(() => {}), 500);
    });
    element.addEventListener('loadedmetadata', () => {
      if (element === audio) syncPlayer();
    });
    element.addEventListener('seeking', () => {
      if (element === audio) {
        cancelClip(true, 'Clip cancelled after jumping in the episode.');
        EchoCapture.clearBuffer();
      }
    });
    element.addEventListener('ended', () => {
      if (element === audio) {
        if (state.activeClip) finishClip();
        updatePlayIcons();
      }
    });
    element.addEventListener('error', () => {
      if (element === audio) handleError();
    });
  }

  function handleError() {
    if (!state.current || state.corsFallback) return;
    cancelClip(false);
    if (state.playbackSource === 'download') {
      toast('This saved episode could not be played. Remove it and download it again.');
      EchoCapture.status();
      return;
    }
    state.corsFallback = true;
    const previous = audio;
    previous.pause();
    EchoCapture.reset();
    const replacement = document.createElement('audio');
    replacement.id = 'audio';
    replacement.preload = 'metadata';
    previous.replaceWith(replacement);
    audio = replacement;
    bind(replacement);
    audio.src = state.current.url;
    audio.load();
    EchoCapture.status();
    audio.play().then(() => {
      toast('Playing this host without clipping access.');
    }).catch(() => {
      toast('This episode could not be played in the browser.');
    });
  }

  return {bind};
})();

