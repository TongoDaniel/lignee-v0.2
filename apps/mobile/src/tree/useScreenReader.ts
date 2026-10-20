// Un lecteur d'écran (TalkBack, VoiceOver) est-il actif ? Suivi à chaud. Le dessin Skia n'est pas
// lu par ces outils : la liste équivalente est alors proposée d'office (TRD, « Accessibilité »).
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (value) => {
        if (active) setEnabled(value);
      },
      () => {
        // Réponse impossible : le dessin reste affiché, la liste reste à un bouton.
      },
    );
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}
