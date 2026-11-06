import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import {
  setSoundsEnabled as setSoundsEnabledModule,
  setSoundsVolume as setSoundsVolumeModule,
  setAlertSoundsEnabled as setAlertSoundsEnabledModule,
} from "../utils/sounds";

export function useSounds() {
  const [soundsEnabled, setSoundsEnabled] = useLocalStorage<boolean>(
    "aeroops.soundsEnabled",
    true
  );
  const [soundsVolume, setSoundsVolume] = useLocalStorage<number>(
    "aeroops.soundsVolume",
    0.5
  );
  const [alertSoundsEnabled, setAlertSoundsEnabled] = useLocalStorage<boolean>(
    "aeroops.alertSoundsEnabled",
    true
  );

  useEffect(() => {
    setSoundsEnabledModule(soundsEnabled);
  }, [soundsEnabled]);

  useEffect(() => {
    setSoundsVolumeModule(soundsVolume);
  }, [soundsVolume]);

  useEffect(() => {
    setAlertSoundsEnabledModule(alertSoundsEnabled);
  }, [alertSoundsEnabled]);

  return {
    soundsEnabled,
    setSoundsEnabled,
    soundsVolume,
    setSoundsVolume,
    alertSoundsEnabled,
    setAlertSoundsEnabled,
  };
}

export default useSounds;
