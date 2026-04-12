export const SOUNDS = {
  SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  CELEBRATE: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  ERROR: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
};

export const playSound = (url: string) => {
  const audio = new Audio(url);
  audio.volume = 0.4;
  audio.play().catch(e => console.log('Audio play blocked:', e));
};
