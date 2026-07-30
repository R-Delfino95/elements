'use client';

import { useCombinedRefs } from './use-combined-refs';
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  allMediaTypes,
  clearMuxDataCookies,
  initialize,
  reinitMuxData,
  teardown,
  MuxMediaProps,
  StreamTypes,
  PlaybackTypes,
  toMuxVideoURL,
  generatePlayerInitTime,
  CmcdTypes,
} from '@mux/playback-core';
import type { PlaybackCore } from '@mux/playback-core';
import { getPlayerVersion } from './env';

export type Props = Omit<
  React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>,
  'autoPlay'
> &
  MuxMediaProps;

export const playerSoftwareVersion = getPlayerVersion();
export const playerSoftwareName = 'mux-video-react';
export { generatePlayerInitTime };

const MuxVideo = React.forwardRef<HTMLVideoElement | undefined, Partial<Props>>((props, ref) => {
  const {
    playbackId,
    src: outerSrc,
    children,
    autoPlay,
    preload,
    tokens,
    playbackToken,
    drmToken,
    ...restProps
  } = props;

  const nativeVideoProps = Object.fromEntries(
    Object.entries(restProps).filter(([key]) => !Object.keys(MuxVideo.propTypes as any).includes(key))
  );

  const [playerInitTime] = useState(props.playerInitTime ?? generatePlayerInitTime());
  const [src, setSrc] = useState<MuxMediaProps['src']>(toMuxVideoURL(props) ?? outerSrc);
  const playbackCoreRef = useRef<PlaybackCore | undefined>(undefined);
  const innerMediaElRef = useRef<HTMLVideoElement>(null);
  const mediaElRef = useCombinedRefs(innerMediaElRef, ref);

  useEffect(() => {
    setSrc(toMuxVideoURL(props) ?? outerSrc);
  }, [outerSrc, playbackId]);

  const getPropsWithState = () => ({
    // NOTE: Applying playerInitTime first as a simple way of overriding it if/when folks update
    // the value via props after initial load (e.g. when swapping src)
    playerInitTime,
    ...props,
    src,
    playerSoftwareName,
    playerSoftwareVersion,
    autoplay: autoPlay,
  });

  // The value `disableCookies` was last applied with.
  const appliedDisableCookiesRef = useRef(props.disableCookies);

  useEffect(() => {
    // mediaEl required caching here so the ref was not null in the unmount callback.
    let mediaEl = mediaElRef.current;
    if (mediaEl) {
      playbackCoreRef.current = initialize(getPropsWithState(), mediaEl, playbackCoreRef.current);
      appliedDisableCookiesRef.current = props.disableCookies;
    }

    return () => {
      teardown(mediaEl, playbackCoreRef.current);
      mediaEl = undefined;
      playbackCoreRef.current = undefined;
    };
  }, [src]);

  // Re-create the monitor, since mux-embed latches `disableCookies` and offers no setter. Only on a
  // change, never on the mounted value: the first client render of a server-rendered page can carry
  // `disableCookies` just because consent isn't known yet, and clearing the cookie there would drop
  // a returning viewer's mux_viewer_id. Same reasoning as <mux-video>.
  useEffect(() => {
    if (appliedDisableCookiesRef.current === props.disableCookies) return;
    appliedDisableCookiesRef.current = props.disableCookies;

    const mediaEl = mediaElRef.current;
    if (!mediaEl || !playbackCoreRef.current) return;

    // Clear after re-attaching: tearing down the old monitor flushes a beacon that rewrites the cookie.
    reinitMuxData(getPropsWithState(), mediaEl, playbackCoreRef.current);
    if (props.disableCookies) {
      clearMuxDataCookies();
    }
  }, [props.disableCookies]);

  useEffect(() => {
    playbackCoreRef.current?.setAutoplay(autoPlay);
  }, [autoPlay]);

  useEffect(() => {
    playbackCoreRef.current?.setPreload(preload);
  }, [preload]);

  return (
    /** @TODO Fix types relationships (CJP) */
    <video ref={mediaElRef as typeof innerMediaElRef} {...nativeVideoProps}>
      {children}
    </video>
  );
});

MuxVideo.propTypes = {
  _hlsConfig: PropTypes.any,
  beaconCollectionDomain: PropTypes.string,
  capRenditionToPlayerSize: PropTypes.bool,
  customDomain: PropTypes.string,
  debug: PropTypes.bool,
  disableCookies: PropTypes.bool,
  disableTracking: PropTypes.bool,
  drmToken: PropTypes.string,
  envKey: PropTypes.string,
  errorTranslator: PropTypes.func,
  liveEdgeStart: PropTypes.number,
  maxResolution: PropTypes.oneOf(['720p', '1080p', '1440p', '2160p']),
  metadata: PropTypes.any,
  minResolution: PropTypes.oneOf(['480p', '540p', '720p', '1080p', '1440p', '2160p']),
  playbackId: PropTypes.string,
  playbackToken: PropTypes.string,
  playerInitTime: PropTypes.number,
  preferCmcd: PropTypes.oneOf(Object.values(CmcdTypes)),
  preferPlayback: PropTypes.oneOf(Object.values(PlaybackTypes)),
  programStartTime: PropTypes.number,
  programEndTime: PropTypes.number,
  assetStartTime: PropTypes.number,
  assetEndTime: PropTypes.number,
  renditionOrder: PropTypes.oneOf(['desc']),
  startTime: PropTypes.number,
  initialBandwidthEstimateKbps: PropTypes.number,
  initialEstimateSegments: PropTypes.number,
  minPreloadSegments: PropTypes.number,
  streamType: PropTypes.oneOf(Object.values(StreamTypes)),
  targetLiveWindow: PropTypes.number,
  tokens: PropTypes.object,
  type: PropTypes.oneOf(allMediaTypes),
};

export default MuxVideo;
