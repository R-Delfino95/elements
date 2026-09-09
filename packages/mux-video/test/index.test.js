import { fixture, assert, aTimeout, oneEvent, waitUntil } from '@open-wc/testing';
import MuxVideoElement, { Events as MuxVideoEvents } from '../src/index.ts';

describe('<mux-video>', () => {
  it('has a Mux specific API', async function () {
    const player = await fixture(`<mux-video
      playback-id="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
      env-key="ilc02s65tkrc2mk69b7q2qdkf"
      start-time="0"
      stream-type="on-demand"
      prefer-playback="mse"
      muted
    ></mux-video>`);

    assert.equal(player.playbackId, 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe', 'playback-id is reflected');
    assert.equal(player.envKey, 'ilc02s65tkrc2mk69b7q2qdkf', 'env-key is reflected');
    assert.equal(player.startTime, 0, 'startTime is set to 0');
    assert.equal(player.streamType, 'on-demand', 'stream-type is vod');
    assert.equal(player.preferPlayback, 'mse', 'prefer mse is on');
    assert.equal(player.debug, false, 'debug is off');
  });

  describe('src derivation', () => {
    it('re-derives src from attributes when it owns the playback id', async function () {
      const player = await fixture(`<mux-video
        playback-id="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
        stream-type="on-demand"
        muted
      ></mux-video>`);

      player.setAttribute('custom-domain', 'example.com');
      assert.equal(new URL(player.src).hostname, 'stream.example.com', 'src follows custom-domain');

      player.setAttribute('asset-start-time', '10');
      assert.equal(new URL(player.src).searchParams.get('asset_start_time'), '10', 'src follows asset-start-time');
    });

    it('leaves an externally set src alone, preserving its search params', async function () {
      // Without a `playback-id`, `src` is the source of truth. Re-deriving it would round-trip
      // through `toPlaybackIdFromSrc()`, which drops the query string — the params below only
      // exist on the src, so a recompute would silently discard them. This is how mux-player
      // uses <mux-video>: it computes the full src itself and forwards `custom-domain` too.
      const src =
        'https://stream.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe.m3u8?redundant_streams=true&asset_start_time=10';
      const player = await fixture(`<mux-video
        custom-domain="mux.com"
        src="${src}"
        stream-type="on-demand"
        muted
      ></mux-video>`);

      assert.equal(player.src, src, 'src survives initial upgrade');

      player.setAttribute('custom-domain', 'example.com');
      assert.equal(player.src, src, 'src survives a custom-domain change');
    });

    it('leaves a non-Mux src alone', async function () {
      // `toPlaybackIdFromSrc()` yields undefined for any src outside `https://stream.`, so
      // `toMuxVideoURL()` returns undefined and the recompute used to blow the src away entirely.
      const src = 'https://my-cdn.example.com/some/playlist.m3u8?sig=abc123';
      const player = await fixture(`<mux-video src="${src}" stream-type="on-demand" muted></mux-video>`);

      player.setAttribute('custom-domain', 'example.com');
      assert.equal(player.src, src, 'src survives a custom-domain change');
    });

    it('keeps params carried on a parameterized playback-id', async function () {
      // A playback id may carry its own query (`toPlaybackIdParts` splits it back off), so those
      // params have to survive a recompute even though no attribute holds them.
      const player = await fixture(`<mux-video
        playback-id="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe?foo=bar"
        muted
      ></mux-video>`);

      assert.equal(new URL(player.src).searchParams.get('foo'), 'bar', 'param present initially');

      player.setAttribute('custom-domain', 'example.com');
      const url = new URL(player.src);
      assert.equal(url.hostname, 'stream.example.com', 'domain updated');
      assert.equal(url.searchParams.get('foo'), 'bar', 'param survives the recompute');
    });

    it('drops non-token params when a playback-token is present', async function () {
      // Intentional: these params only work on public playback ids, so with a signed URL they
      // have to be baked into the token instead. Pinned so the guard above isn't mistaken for a
      // promise that every param always survives.
      const player = await fixture(`<mux-video
        playback-id="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
        asset-start-time="10"
        playback-token="TOKEN"
        muted
      ></mux-video>`);

      player.setAttribute('custom-domain', 'example.com');
      const url = new URL(player.src);
      assert.equal(url.hostname, 'stream.example.com', 'domain still updates');
      assert.deepEqual([...url.searchParams.keys()], ['token'], 'only the token remains');
    });

    it('takes over src derivation once a playback-id is added', async function () {
      const player = await fixture(`<mux-video
        src="https://stream.mux.com/OTHERID.m3u8?redundant_streams=true"
        custom-domain="mux.com"
        muted
      ></mux-video>`);

      player.setAttribute('playback-id', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe');
      assert.equal(
        player.src,
        'https://stream.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe.m3u8',
        'an explicit playback-id wins over the previous src'
      );
    });

    it('leaves src alone when playback-id is removed', async function () {
      const player = await fixture(`<mux-video
        playback-id="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
        custom-domain="example.com"
        muted
      ></mux-video>`);
      const derived = player.src;

      player.removeAttribute('playback-id');
      assert.equal(player.src, derived, 'removing playback-id is a no-op on src');
    });

    it('falls back to the default domain when custom-domain is removed', async function () {
      const player = await fixture(`<mux-video
        playback-id="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
        custom-domain="example.com"
        muted
      ></mux-video>`);

      player.removeAttribute('custom-domain');
      assert.equal(new URL(player.src).hostname, 'stream.mux.com', 'src falls back to stream.mux.com');
    });

    it('clears src for a present-but-empty playback-id', async function () {
      // Long-standing behavior, not introduced by the guard: the guard keys on the attribute
      // being *present*, and an empty playback id yields no URL at all. `removeAttribute` is the
      // non-destructive way to step back from owning the src.
      const player = await fixture(`<mux-video
        playback-id=""
        src="https://stream.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe.m3u8?redundant_streams=true"
        muted
      ></mux-video>`);

      assert.isNull(player.src, 'an empty playback-id clears the src');
    });
  });

  it('dispatches events properly', async function () {
    this.timeout(10000);

    const player = await fixture(`<mux-video
      muted
      preload="auto"
    ></mux-video>`);

    const eventMap = {};
    MuxVideoEvents.forEach((type) => {
      eventMap[type] = false;
      player.addEventListener(type, (e) => {
        assert.equal(e.target, player);
        eventMap[e.type] = true;
      });
    });

    player.playbackId = 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe';
    await aTimeout(100);

    player.volume = 0.5;

    try {
      await player.play();
    } catch (error) {
      console.warn(error);
    }

    await aTimeout(250);

    assert.deepInclude(eventMap, {
      canplay: true,
      durationchange: true,
      loadeddata: true,
      loadedmetadata: true,
      loadstart: true,
      play: true,
      playing: true,
      timeupdate: true,
      volumechange: true,
      resize: true,
    });
  });

  it('can use extended autoplay properties on initial load', async function () {
    const player = await fixture(`<mux-video
      autoplay="muted"
    ></mux-video>`);

    assert.equal(player.autoplay, 'muted', 'our autoplay setting is muted');
  });

  it('can use extended autoplay properties', async function () {
    const player = await fixture(`<mux-video
    ></mux-video>`);

    assert.equal(player.autoplay, false, 'initial autoplay is false');

    player.autoplay = 'muted';

    assert.equal(player.autoplay, 'muted', 'can set autoplay to "muted"');
    assert.equal(player.getAttribute('autoplay'), 'muted', 'the attribute is set to "muted"');

    player.autoplay = 'any';

    assert.equal(player.autoplay, 'any', 'can set autoplay to "any"');
    assert.equal(player.getAttribute('autoplay'), 'any', 'the attribute is set to "muted"');

    player.autoplay = false;

    assert.isFalse(player.autoplay, 'can turn off autoplay');
    assert.isFalse(player.hasAttribute('autoplay'), 'setting to false reomves the attribute');

    player.autoplay = true;
    assert.isTrue(player.autoplay, 'can turn off autoplay');
    assert.equal(player.getAttribute('autoplay'), '', 'when prop is set to true, attribute value is an empty string');
  });

  it('can use extended autoplay attributes', async function () {
    const player = await fixture(`<mux-video
    ></mux-video>`);

    assert.equal(player.autoplay, false, 'initial autoplay is false');

    player.setAttribute('autoplay', 'muted');

    assert.equal(player.autoplay, 'muted', 'can set autoplay to "muted"');
    assert.equal(player.getAttribute('autoplay'), 'muted', 'the attribute is set to "muted"');

    player.setAttribute('autoplay', 'any');

    assert.equal(player.autoplay, 'any', 'can set autoplay to "any"');
    assert.equal(player.getAttribute('autoplay'), 'any', 'the attribute is set to "muted"');

    player.removeAttribute('autoplay');
    player.autoplay = false;

    assert.isFalse(player.autoplay, 'can turn off autoplay');
    assert.isFalse(player.hasAttribute('autoplay'), 'setting to false reomves the attribute');

    player.setAttribute('autoplay', '');
    assert.isTrue(player.autoplay, 'can turn off autoplay');
    assert.equal(player.getAttribute('autoplay'), '', 'when prop is set to true, attribute value is an empty string');
  });

  it('preload is forwarded to the native el', async function () {
    const player = await fixture(`<mux-video
      src="https://stream.mux.com/23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I.m3u8"
    ></mux-video>`);

    assert.equal(player.preload, 'metadata', 'browser default preload is metadata');

    player.setAttribute('preload', '');
    assert.equal(player.preload, 'auto', 'preload="" attribute maps to the auto state');
    assert.equal(player.nativeEl.preload, 'auto', 'native preload="" attribute maps to the auto state');

    player.preload = null;
    assert.equal(player.preload, 'metadata', 'browser default preload is metadata');
    assert.equal(player.nativeEl.preload, 'metadata', 'native browser default preload is metadata');

    player.preload = 'auto';
    assert.equal(player.getAttribute('preload'), 'auto', 'preload attr is auto');
    assert.equal(player.nativeEl.getAttribute('preload'), 'auto', 'native preload attr is auto');
  });

  it('can use preload="none" and play', async function () {
    this.timeout(10000);

    const player = await fixture(`<mux-video
      src="https://stream.mux.com/23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I.m3u8"
      preload="none"
      muted
    ></mux-video>`);

    assert.equal(player.preload, 'none', 'preload is none');
    await aTimeout(3000);
    assert.equal(player.buffered.length, 0, 'no buffer loaded');

    try {
      await player.play();
    } catch (error) {
      console.warn(error);
    }

    assert(!player.paused, 'is playing after play()');
  });

  it('forward max-resolution attr as a query param', async function () {
    const player = await fixture(`<mux-video
      max-resolution="720p"
      playback-id="23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I"
    ></mux-video>`);

    assert.equal(player.maxResolution, '720p');
    assert.equal(
      player._hls.url,
      'https://stream.mux.com/23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I.m3u8?max_resolution=720p'
    );

    player.removeAttribute('max-resolution');
    assert.equal(player.maxResolution, null);
    player.maxResolution = '720p';
    assert.equal(player.maxResolution, '720p');
  });

  it('maps arbitrary metadata-* attrs to the metadata prop and populates video_id if not provided', async function () {
    const playbackId = '23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I';
    const player = await fixture(`<mux-video
      src="https://stream.mux.com/${playbackId}.m3u8"
      metadata-video-title="Video Title"
      metadata-sub-property-id="sub-id-12"
    ></mux-video>`);

    assert.equal(player.metadata.video_title, 'Video Title');
    assert.equal(player.metadata.sub_property_id, 'sub-id-12');
    assert.equal(player.metadata.video_id, playbackId);
  });

  it('currentPdt and getStartDate work as expected', async function () {
    this.timeout(5000);

    const player = await fixture(`<mux-video
      src="https://stream.mux.com/UgKrPYAnjMjP6oMF4Kcs1gWVhtgYDR02EHQGnj022X1Xo.m3u8"
      env-key="ilc02s65tkrc2mk69b7q2qdkf"
      prefer-playback="mse"
      muted
      preload="auto"
    ></mux-video>`);

    await aTimeout(1000);

    player.currentTime = 60;

    await aTimeout(50);

    const currentPdt = player.currentPdt;
    const startDate = player.getStartDate();

    assert.equal(
      startDate.getTime(),
      currentPdt.getTime() - player.currentTime * 1000,
      'currentPdt should be ~60 seconds greater than getStartDate'
    );
  });

  describe('Feature: mp4 playback', async () => {
    it('supports mp4 src', async () => {
      const src = 'https://stream.mux.com/a4nOgmxGWg6gULfcBbAa00gXyfcwPnAFldF8RdsNyk8M/low.mp4';
      let muxVideoEl;
      try {
        muxVideoEl = await fixture(`<mux-video
          src="${src}"
          preload="auto"
          autoplay
          muted
        ></mux-video>`);
      } catch (err) {
        assert.fail(`mux-video threw an error on instantiating with an mp4 src, ${err}`);
      }
      await waitUntil(() => !muxVideoEl.paused, 'playback should begin for mp4');
    });

    it('exposes extended media element stream info for mp4s', async () => {
      const src = 'https://stream.mux.com/a4nOgmxGWg6gULfcBbAa00gXyfcwPnAFldF8RdsNyk8M/low.mp4';
      let muxVideoEl;
      try {
        muxVideoEl = await fixture(`<mux-video
          src="${src}"
          autoplay
        ></mux-video>`);
      } catch (err) {
        assert.fail(`mux-video threw an error on instantiating with an mp4 src, ${err}`);
      }
      await waitUntil(() => muxVideoEl.streamType, 'should have a streamType of on-demand');
      await waitUntil(
        () => Number.isNaN(muxVideoEl.targetLiveWindow),
        'should have a targetLiveWindow of NaN because mp4s are always on-demand'
      );
      await waitUntil(
        () => Number.isNaN(muxVideoEl.liveEdgeStart),
        'should have a liveEdgeStart of NaN because mp4s are always on-demand'
      );
    });
  });

  describe('Feature: cuePoints', async () => {
    it('adds cuepoints', async () => {
      const cuePoints = [
        { time: 0, value: { label: 'CTA 1', showDuration: 10 } },
        { time: 15, value: { label: 'CTA 2', showDuration: 5 } },
        { time: 21, value: { label: 'CTA 3', showDuration: 2 } },
      ];
      const playbackId = '23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
      ></mux-video>`);
      await muxVideoEl.addCuePoints(cuePoints);
      assert.deepEqual(muxVideoEl.cuePoints, cuePoints);
    });

    it('dispatches a cuepointchange event when the active cuepoint changes', async () => {
      const cuePoints = [
        { time: 0, value: { label: 'CTA 1', showDuration: 10 } },
        { time: 15, value: { label: 'CTA 2', showDuration: 5 } },
        { time: 21, value: { label: 'CTA 3', showDuration: 2 } },
      ];
      const playbackId = '23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
      ></mux-video>`);
      // NOTE: Since cuepoints get reset by (re/un)setting a media source/playback-id,
      // waiting until ~the next frame before adding cuePoints.
      // Alternatively, if we wanted something event-driven, we could wait until metadata
      // has loaded (Commented out, below) (CJP)
      await aTimeout(50);
      // await oneEvent(muxVideoEl, 'loadedmetadata');
      await muxVideoEl.addCuePoints(cuePoints);
      const expectedCuePoint = cuePoints[1];
      muxVideoEl.currentTime = expectedCuePoint.time + 0.01;
      const event = await oneEvent(muxVideoEl, 'cuepointchange');
      assert.equal(event.target, muxVideoEl, 'event target should be the MuxVideoElement instance');
      assert.deepEqual(event.detail, expectedCuePoint);
      assert.deepEqual(muxVideoEl.activeCuePoint, expectedCuePoint);
    });

    it('clears cuepoints when playback-id is updated', async () => {
      const cuePoints = [
        { time: 0, value: { label: 'CTA 1', showDuration: 10 } },
        { time: 15, value: { label: 'CTA 2', showDuration: 5 } },
        { time: 21, value: { label: 'CTA 3', showDuration: 2 } },
      ];
      const playbackId = '23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
      ></mux-video>`);
      await aTimeout(50);
      await muxVideoEl.addCuePoints(cuePoints);
      assert.deepEqual(muxVideoEl.cuePoints, cuePoints); // confirm set to ensure valid test
      muxVideoEl.playbackId = 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe';
      await oneEvent(muxVideoEl, 'emptied');
      assert.equal(muxVideoEl.cuePoints.length, 0, 'cuePoints should be empty');
    });
  });

  describe('Feature: capRenditionToPlayerSize', async () => {
    it('capRenditionToPlayerSize is undefined by default', async () => {
      const muxVideoEl = await fixture(`<mux-video></mux-video>`);
      assert.isUndefined(muxVideoEl.capRenditionToPlayerSize, 'default should be undefined');
    });

    it('cap-rendition-to-player-size attribute sets property to true', async () => {
      const muxVideoEl = await fixture(`<mux-video cap-rendition-to-player-size></mux-video>`);
      assert.isTrue(muxVideoEl.capRenditionToPlayerSize, 'should be true when attribute is present');
    });

    it('cap-rendition-to-player-size="" attribute sets property to true', async () => {
      const muxVideoEl = await fixture(`<mux-video cap-rendition-to-player-size=""></mux-video>`);
      assert.isTrue(muxVideoEl.capRenditionToPlayerSize, 'should be true when attribute is empty string');
    });

    it('capRenditionToPlayerSize property can be set to true', async () => {
      const muxVideoEl = await fixture(`<mux-video></mux-video>`);
      muxVideoEl.capRenditionToPlayerSize = true;
      assert.isTrue(muxVideoEl.capRenditionToPlayerSize, 'should be true after setting property');
    });

    it('capRenditionToPlayerSize property can be set to false', async () => {
      const muxVideoEl = await fixture(`<mux-video></mux-video>`);
      muxVideoEl.capRenditionToPlayerSize = false;
      assert.isFalse(muxVideoEl.capRenditionToPlayerSize, 'should be false after setting property');
    });

    it('capRenditionToPlayerSize property can be set to undefined', async () => {
      const muxVideoEl = await fixture(`<mux-video cap-rendition-to-player-size></mux-video>`);
      assert.isTrue(muxVideoEl.capRenditionToPlayerSize, 'should be true initially');
      muxVideoEl.capRenditionToPlayerSize = undefined;
      assert.isUndefined(muxVideoEl.capRenditionToPlayerSize, 'should be undefined after setting property');
    });

    it('removing cap-rendition-to-player-size attribute sets property to undefined', async () => {
      const muxVideoEl = await fixture(`<mux-video cap-rendition-to-player-size></mux-video>`);
      assert.isTrue(muxVideoEl.capRenditionToPlayerSize, 'should be true initially');
      muxVideoEl.removeAttribute('cap-rendition-to-player-size');
      assert.isUndefined(muxVideoEl.capRenditionToPlayerSize, 'should be undefined after removing attribute');
    });

    it('_hlsConfig.capLevelToPlayerSize takes precedence over property', async () => {
      const muxVideoEl = await fixture(`<mux-video></mux-video>`);
      muxVideoEl.capRenditionToPlayerSize = true;
      muxVideoEl._hlsConfig = { capLevelToPlayerSize: false };
      assert.isFalse(muxVideoEl.capRenditionToPlayerSize, '_hlsConfig should take precedence');
    });

    // Integration tests that verify the underlying hls.js instance is configured correctly
    it('hls.js uses MinCapLevelController when capRenditionToPlayerSize is undefined (default)', async () => {
      const muxVideoEl = await fixture(`<mux-video
        playback-id="23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I"
        preload="none"
        prefer-playback="mse"
      ></mux-video>`);

      // Wait for hls.js to be initialized
      await waitUntil(() => muxVideoEl._hls, 'hls.js instance should be created');

      assert.equal(muxVideoEl._hls.config.capLevelToPlayerSize, true, 'should default to true');
      // MinCapLevelController has a static minMaxResolution property, standard CapLevelController does not
      assert.isDefined(
        muxVideoEl._hls.config.capLevelController.minMaxResolution,
        'should use MinCapLevelController (has minMaxResolution property)'
      );
    });

    it('hls.js uses CapLevelController when capRenditionToPlayerSize is explicitly true', async () => {
      const muxVideoEl = await fixture(`<mux-video
        playback-id="23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I"
        preload="none"
        prefer-playback="mse"
        cap-rendition-to-player-size
      ></mux-video>`);

      await waitUntil(() => muxVideoEl._hls, 'hls.js instance should be created');

      assert.equal(muxVideoEl._hls.config.capLevelToPlayerSize, true, 'should be true');
      // MinCapLevelController has a static minMaxResolution property, standard CapLevelController does not
      assert.isUndefined(
        muxVideoEl._hls.config.capLevelController.minMaxResolution,
        'should use standard CapLevelController (no minMaxResolution property)'
      );
    });

    it('hls.js uses CapLevelController when capRenditionToPlayerSize is false via property', async () => {
      const muxVideoEl = await fixture(`<mux-video
        preload="none"
        prefer-playback="mse"
      ></mux-video>`);

      // Set capRenditionToPlayerSize to false before setting playbackId
      muxVideoEl.capRenditionToPlayerSize = false;
      muxVideoEl.playbackId = '23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I';

      await waitUntil(() => muxVideoEl._hls, 'hls.js instance should be created');

      assert.equal(muxVideoEl._hls.config.capLevelToPlayerSize, false, 'should be false');
      // MinCapLevelController has a static minMaxResolution property, standard CapLevelController does not
      assert.isUndefined(
        muxVideoEl._hls.config.capLevelController.minMaxResolution,
        'should use standard CapLevelController (no minMaxResolution property)'
      );
    });
  });

  describe('Feature: inferred streamType & related', async () => {
    it('infers on-demand streamType for on demand content', async () => {
      const playbackId = '23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
        preload="metadata"
      ></mux-video>`);
      await oneEvent(muxVideoEl, 'streamtypechange');
      assert.equal(muxVideoEl.streamType, 'on-demand');
    });

    it('infers targetLiveWindow NaN for on demand content', async () => {
      const playbackId = '23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
        preload="metadata"
      ></mux-video>`);
      await oneEvent(muxVideoEl, 'targetlivewindowchange');
      assert(Number.isNaN(muxVideoEl.targetLiveWindow), 'targetLiveWindow should be NaN');
    });

    it('infers liveEdgeStart NaN for on demand content', async () => {
      const playbackId = '23s11nz72DsoN657h4314PjKKjsF2JG33eBQQt6B95I';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
        preload="metadata"
      ></mux-video>`);
      // Wait for this event simply to guarantee inferred values have been computed
      await oneEvent(muxVideoEl, 'streamtypechange');
      assert(Number.isNaN(muxVideoEl.liveEdgeStart), 'liveEdgeStart should be NaN');
    });

    it('infers live streamType for live content', async () => {
      const playbackId = 'v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
        preload="metadata"
      ></mux-video>`);
      await oneEvent(muxVideoEl, 'streamtypechange');
      assert.equal(muxVideoEl.streamType, 'live');
    });

    it('infers targetLiveWindow 0 for live content', async () => {
      const playbackId = 'v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
        preload="metadata"
      ></mux-video>`);
      await oneEvent(muxVideoEl, 'targetlivewindowchange');
      assert.equal(muxVideoEl.targetLiveWindow, 0);
    });

    it('infers liveEdgeStart >= 0 for live content', async () => {
      const playbackId = 'v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
        preload="metadata"
      ></mux-video>`);
      // Wait for this event simply to guarantee inferred values have been computed
      await oneEvent(muxVideoEl, 'streamtypechange');
      assert(muxVideoEl.liveEdgeStart >= 0, 'liveEdgeStart should be a positive number');
    });

    it('adjusts live seekable for hls.js-based playback', async () => {
      const playbackId = 'v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM';
      const muxVideoEl = await fixture(`<mux-video
        playback-id="${playbackId}"
        preload="metadata"
        prefer-playback="mse"
      ></mux-video>`);
      // Wait for this event simply to guarantee inferred values have been computed
      await oneEvent(muxVideoEl, 'streamtypechange');
      // Since hls.js doesn't apply
      assert(
        muxVideoEl.seekable.end(0) < muxVideoEl.nativeEl.seekable.end(0),
        'seekable should be adjusted based on holdback and related'
      );
    });
  });
});
