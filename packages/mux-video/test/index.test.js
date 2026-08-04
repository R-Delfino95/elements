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

describe('<mux-video> disable-cookies', () => {
  const PLAYBACK_ID = 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe';
  const VIEWER_ID = 'test-viewer-id';

  const readMuxDataCookie = () => document.cookie.split('; ').find((c) => c.startsWith('muxData')) ?? null;

  const plantMuxDataCookie = () => {
    document.cookie = `muxData==undefined&mux_viewer_id=${VIEWER_ID}&msn=0.5&sid=s&sst=1&sex=9999999999999;path=/;max-age=3600`;
  };

  const forgetMuxDataCookie = () => {
    document.cookie = `muxData=;expires=${new Date(0).toUTCString()};path=/`;
  };

  /**
   * Stand-in for mux-embed that records the options each monitor was created with, so a re-attached
   * monitor can be told from a re-used one without sending beacons.
   */
  const createMuxDataSDKSpy = ({ flushOnDestroy = false, deferFlush = false } = {}) => {
    const monitors = [];
    // Stands in for the final beacon mux-embed sends from destroy(), which refreshes the cookie
    // using the options the monitor was created with.
    const flush = (options) => {
      if (!flushOnDestroy || options.disableCookies) return;
      const write = () => {
        document.cookie = `muxData==undefined&sid=s&sst=1&sex=9999999999999;path=/;max-age=3600`;
      };
      if (deferFlush) Promise.resolve().then(write);
      else write();
    };
    return {
      monitors,
      monitor(mediaEl, options) {
        const record = { options, destroyed: false };
        monitors.push(record);
        mediaEl.mux = {
          deleted: false,
          emit() {},
          addHLSJS() {},
          removeHLSJS() {},
          destroy() {
            record.destroyed = true;
            this.deleted = true;
            flush(options);
          },
        };
      },
    };
  };

  /** Loads a player with the Mux Data SDK spied on from the very first monitor. */
  const fixtureWithSpy = async (attrs = '', spyOptions) => {
    const player = await fixture(`<mux-video muted ${attrs}></mux-video>`);
    const muxDataSDK = createMuxDataSDKSpy(spyOptions);
    player.muxDataSDK = muxDataSDK;
    // Setting the playback id is what triggers the first load, and with it the first monitor.
    player.playbackId = PLAYBACK_ID;
    await aTimeout(50);
    return { player, muxDataSDK };
  };

  afterEach(() => {
    forgetMuxDataCookie();
  });

  it('re-attaches Mux Data when disable-cookies is turned on', async () => {
    const { player, muxDataSDK } = await fixtureWithSpy();
    assert.equal(muxDataSDK.monitors.length, 1, 'monitored once on load');
    assert.notOk(muxDataSDK.monitors[0].options.disableCookies, 'cookies enabled to begin with');

    player.disableCookies = true;
    await aTimeout(0);

    assert.equal(muxDataSDK.monitors.length, 2, 'monitor was re-created');
    assert.isTrue(muxDataSDK.monitors[0].destroyed, 'the previous monitor was destroyed');
    assert.isTrue(muxDataSDK.monitors[1].options.disableCookies, 'the new monitor has cookies disabled');
  });

  it('re-attaches Mux Data when disable-cookies is turned off', async () => {
    const { player, muxDataSDK } = await fixtureWithSpy('disable-cookies');
    assert.isTrue(muxDataSDK.monitors[0].options.disableCookies, 'cookies disabled to begin with');

    player.disableCookies = false;
    await aTimeout(0);

    assert.equal(muxDataSDK.monitors.length, 2, 'monitor was re-created');
    assert.notOk(muxDataSDK.monitors[1].options.disableCookies, 'the new monitor has cookies enabled');
  });

  it('does not re-attach Mux Data when the same value is re-applied', async () => {
    const { player, muxDataSDK } = await fixtureWithSpy();

    player.setAttribute('disable-cookies', '');
    await aTimeout(0);
    assert.equal(muxDataSDK.monitors.length, 2, 'the change was applied');

    // attributeChangedCallback fires even when the value is identical.
    player.setAttribute('disable-cookies', '');
    await aTimeout(0);
    assert.equal(muxDataSDK.monitors.length, 2, 'no monitor for a redundant re-apply');
  });

  it('coalesces several changes in the same tick into a single monitor', async () => {
    const { player, muxDataSDK } = await fixtureWithSpy();

    player.disableCookies = true;
    player.disableCookies = false;
    player.disableCookies = true;
    await aTimeout(0);

    assert.equal(muxDataSDK.monitors.length, 2, 'one monitor for the whole burst');
    assert.isTrue(muxDataSDK.monitors[1].options.disableCookies, 'created with the settled value');
  });

  it('leaves Mux Data on the settled value when a change is reverted', async () => {
    const { player, muxDataSDK } = await fixtureWithSpy();

    // Same tick: the value the monitor is created with is read when it is created, not when the
    // change came in, so a reverted change can't leave Mux Data out of sync with the attribute.
    player.disableCookies = true;
    player.disableCookies = false;
    await aTimeout(0);

    assert.notOk(muxDataSDK.monitors[muxDataSDK.monitors.length - 1].options.disableCookies);

    // ...and the next real change is still picked up.
    player.disableCookies = true;
    await aTimeout(0);

    assert.isTrue(muxDataSDK.monitors[muxDataSDK.monitors.length - 1].options.disableCookies);
  });

  it('applies a change and its revert in separate ticks', async () => {
    const { player, muxDataSDK } = await fixtureWithSpy();

    player.disableCookies = true;
    await aTimeout(0);
    player.disableCookies = false;
    await aTimeout(0);

    assert.equal(muxDataSDK.monitors.length, 3, 'monitored again for each change');
    assert.isTrue(muxDataSDK.monitors[1].options.disableCookies);
    assert.notOk(muxDataSDK.monitors[2].options.disableCookies);
  });

  it('does not reload the media when disable-cookies changes', async () => {
    const { player } = await fixtureWithSpy();

    const mediaEvents = [];
    ['emptied', 'loadstart', 'abort'].forEach((type) => {
      player.addEventListener(type, () => mediaEvents.push(type));
    });

    player.disableCookies = true;
    await aTimeout(50);

    assert.deepEqual(mediaEvents, [], 'the media element was left alone');
  });

  it('clears the muxData cookie when cookies are disabled at runtime', async () => {
    const { player } = await fixtureWithSpy();
    plantMuxDataCookie();

    player.disableCookies = true;
    await aTimeout(0);

    assert.equal(readMuxDataCookie(), null, 'the cookie was cleared');
  });

  it('keeps an existing muxData cookie when it initializes with disable-cookies', async () => {
    // A server-rendered page can't read consent, so it always emits the cookie-less state. Clearing
    // there would drop a returning viewer's mux_viewer_id before consent can be granted.
    plantMuxDataCookie();

    const { muxDataSDK } = await fixtureWithSpy('disable-cookies');

    assert.include(readMuxDataCookie(), VIEWER_ID, 'the cookie was left alone');
    assert.equal(muxDataSDK.monitors.length, 1, 'no re-attach was needed');
    assert.isTrue(muxDataSDK.monitors[0].options.disableCookies, 'and cookies are disabled');
  });

  it('clears the cookie even when a monitor flushes its final beacon asynchronously', async () => {
    const { player } = await fixtureWithSpy('', { flushOnDestroy: true, deferFlush: true });
    plantMuxDataCookie();

    player.disableCookies = true;
    await aTimeout(0);

    assert.equal(readMuxDataCookie(), null, 'the flush cannot outlive the clear');
  });

  it('clears the shared cookie when several players are disabled at once', async () => {
    // There is one cookie for every player on the page, and each teardown flush rewrites it, so the
    // clears have to expire the cookie unconditionally instead of only what they just read.
    const players = [];
    for (let i = 0; i < 3; i += 1) {
      players.push(await fixtureWithSpy('', { flushOnDestroy: true }));
    }
    plantMuxDataCookie();

    players.forEach(({ player }) => {
      player.disableCookies = true;
    });
    await aTimeout(0);

    assert.equal(readMuxDataCookie(), null, 'no player is left holding the cookie');
    players.forEach(({ muxDataSDK }, i) => {
      assert.isTrue(muxDataSDK.monitors[1]?.options.disableCookies, `player ${i} re-attached with cookies off`);
    });
  });

  it('clears the cookie with several players disabled in the same tick', async () => {
    // Every player flushes a final beacon that rewrites the shared cookie, so the flushes and the
    // clears must not interleave: one player writing after another has cleared would leave the
    // cookie behind (session fields only, no mux_viewer_id).
    const players = [];
    for (let i = 0; i < 3; i++) {
      players.push(await fixtureWithSpy('', { flushOnDestroy: true }));
    }
    plantMuxDataCookie();

    players.forEach(({ player }) => {
      player.disableCookies = true;
    });
    await aTimeout(0);

    assert.equal(readMuxDataCookie(), null, 'no player wrote the cookie back after the clears');
  });

  it('keeps chapters and their text track across the change', async function () {
    this.timeout(10000);

    const player = await fixture(`<mux-video
      playback-id="${PLAYBACK_ID}"
      preload="metadata"
      prefer-playback="mse"
      muted
    ></mux-video>`);
    await oneEvent(player, 'loadstart');
    await player.addChapters([
      { startTime: 0, endTime: 5, value: 'One' },
      { startTime: 5, endTime: 10, value: 'Two' },
    ]);
    const chaptersTrack = Array.from(player.textTracks).find((track) => track.kind === 'chapters');

    player.disableCookies = true;
    await aTimeout(50);

    assert.equal(player.chapters.length, 2, 'chapters survived');
    assert.isTrue(Array.from(player.textTracks).includes(chaptersTrack), 'and so did their text track');
  });
});
