// Регистрация ролика канала в Root.tsx студии: композиция <id> (16:9, хронометраж — calcVoiced, движок — VoicedVideo)
// и обложка <id>-thumb 1280×720; варианты обложки из config.thumbs — <id>-thumb-b, <id>-thumb-c (не больше
// VIDEO_LIMITS.thumbVariants; лист читаемости — scripts/yt-thumb.mjs). Обложку рисует компонент канала (Thumb).
//   const Compositions = voicedCompositions<YtConfig>(channel, Thumb);  …  <Compositions config={…} />
import React from 'react';
import {Composition, Still} from 'remotion';
import {BASE_FPS} from '../time/fps';
import {VIDEO_LIMITS} from '../qa/limits';
import {calcVoiced} from '../voice/calc';
import {VoicedVideo} from './VoicedVideo';
import type {Channel} from './registry';
import type {VoicedConfig, VoicedProps} from './types';

type WithThumb = VoicedConfig<any> & {thumb: object; thumbs?: object[]};

export const voicedCompositions = <C extends WithThumb>(channel: Channel, Thumb: React.FC<{config: C}>): React.FC<{config: C}> => {
  const calc = calcVoiced<VoicedProps<C>>(channel);
  const Video: React.FC<VoicedProps<C>> = (props) => <VoicedVideo {...props} channel={channel} />;
  return ({config}) => (
    <>
      <Composition
        id={config.id}
        component={Video}
        defaultProps={{config} as VoicedProps<C>}
        calculateMetadata={calc}
        durationInFrames={300}
        fps={BASE_FPS}
        width={1920}
        height={1080}
      />
      <Still id={`${config.id}-thumb`} component={Thumb} defaultProps={{config}} width={1280} height={720} />
      {(config.thumbs ?? []).slice(0, VIDEO_LIMITS.thumbVariants - 1).map((v, i) => (
        <Still key={i} id={`${config.id}-thumb-${'bc'[i]}`} component={Thumb} defaultProps={{config: {...config, thumb: {...config.thumb, ...v}}}} width={1280} height={720} />
      ))}
    </>
  );
};
