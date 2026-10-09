import { useState } from 'react';
import { ScreenFrame } from '../nav/ScreenFrame.tsx';
import { useNav } from '../nav/useNav.ts';
import { MAX_NAME, useProfile } from '../profile/useProfile.ts';
import { useSettings } from '../settings/useSettings.ts';
import { Box, Button } from '../ui/retro/index.ts';
import { OfflineSettings } from './OfflineSettings.tsx';

export function Options() {
  const sound = useSettings((s) => s.sound);
  const setSound = useSettings((s) => s.setSound);
  const skipTitle = useSettings((s) => s.skipTitle);
  const setSkipTitle = useSettings((s) => s.setSkipTitle);
  const current = useProfile((s) => s.profile.playerName);
  const setName = useProfile((s) => s.setName);
  const replayIntro = useProfile((s) => s.replayIntro);
  const collectorMode = useProfile((s) => s.profile.collectorMode);
  const setCollectorMode = useProfile((s) => s.setCollectorMode);
  const [name, setNameDraft] = useState(current ?? '');
  return (
    <ScreenFrame>
      <Box title="Options">
        <div className="flex flex-col gap-5">
          <label className="flex items-center gap-3 font-pixel text-xs">
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => setSound(e.target.checked)}
              className="size-5"
            />
            Sound
          </label>
          <label className="flex items-center gap-3 font-pixel text-xs">
            <input
              type="checkbox"
              checked={skipTitle}
              onChange={(e) => setSkipTitle(e.target.checked)}
              className="size-5"
            />
            Skip title screen
          </label>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-3 font-pixel text-xs">
              <input
                type="checkbox"
                checked={collectorMode}
                onChange={(e) => void setCollectorMode(e.target.checked)}
                aria-describedby="collector-hint"
                className="size-5"
              />
              Collector mode
            </label>
            <p id="collector-hint" className="pl-8 text-lg">
              Free packs. Battling is hidden.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-2">
              <span className="font-pixel text-[10px]">Change name</span>
              <input
                aria-label="Change name"
                maxLength={MAX_NAME}
                value={name}
                onChange={(e) => setNameDraft(e.target.value)}
                className="border-b-4 border-ink bg-transparent px-1 font-pixel text-sm uppercase outline-none"
              />
            </label>
            <Button aria-label="Save name" onClick={() => void setName(name)}>
              Save
            </Button>
          </div>
          <Button
            variant="plain"
            className="self-start"
            onClick={() => void replayIntro().then(() => useNav.getState().go('intro'))}
          >
            Replay intro
          </Button>
          <OfflineSettings />
        </div>
      </Box>
    </ScreenFrame>
  );
}
