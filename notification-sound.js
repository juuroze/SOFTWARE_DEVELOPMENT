(function () {
    var STORAGE_KEY = 'jurisync-sound-muted';
    var MIN_GAP_MS = 1500;
    var ctx = null;
    var lastPlayed = 0;
    var buttons = [];

    function isMuted() {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function getContext() {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!ctx) ctx = new AudioCtx();
        return ctx;
    }

    function unlock() {
        var c = getContext();
        if (c && c.state === 'suspended') c.resume().catch(function () {});
    }

    ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
        window.addEventListener(evt, unlock, { passive: true });
    });

    function note(c, frequency, startAt, duration, volume) {
        var osc = c.createOscillator();
        var overtone = c.createOscillator();
        var gain = c.createGain();
        osc.type = 'sine';
        overtone.type = 'triangle';
        osc.frequency.value = frequency;
        overtone.frequency.value = frequency * 2;
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        osc.connect(gain);
        overtone.connect(gain);
        gain.connect(c.destination);
        osc.start(startAt);
        overtone.start(startAt);
        osc.stop(startAt + duration + 0.05);
        overtone.stop(startAt + duration + 0.05);
    }

    function schedule(c) {
        var t = c.currentTime + 0.02;
        note(c, 784, t, 0.45, 0.16);
        note(c, 988, t + 0.15, 0.45, 0.16);
        note(c, 1175, t + 0.3, 0.7, 0.18);
    }

    function play(force) {
        if (!force && isMuted()) return false;
        var now = Date.now();
        if (!force && now - lastPlayed < MIN_GAP_MS) return false;
        lastPlayed = now;
        var c = getContext();
        if (!c) return false;
        if (c.state === 'running') {
            schedule(c);
        } else {
            c.resume().then(function () {
                if (c.state === 'running') schedule(c);
            }).catch(function () {});
        }
        return true;
    }

    function paint(btn) {
        var muted = isMuted();
        var icon = btn.querySelector('i');
        if (icon) icon.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
        btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
        btn.setAttribute('aria-label', muted ? 'Turn notification sound on' : 'Turn notification sound off');
        btn.title = muted ? 'Notification sound is off' : 'Notification sound is on';
    }

    function setMuted(value) {
        try {
            localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
        } catch (e) {}
        buttons.forEach(paint);
    }

    function bindToggle(btn) {
        if (!btn || btn.dataset.soundBound) return;
        btn.dataset.soundBound = '1';
        buttons.push(btn);
        paint(btn);
        btn.addEventListener('click', function () {
            var nowMuted = !isMuted();
            setMuted(nowMuted);
            if (!nowMuted) play(true);
        });
    }

    window.JuriSyncSound = { play: play, isMuted: isMuted, setMuted: setMuted, bindToggle: bindToggle };
})();