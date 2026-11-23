import { useStore } from '../store/Store';

/** Hex palette for SVG charts (SVG attributes can't read CSS variables reliably). */
export function usePalette() {
  const { data } = useStore();
  const light = data.settings.theme === 'light';
  return light
    ? { route: '#4A7300', boulder: '#C2560F', blue: '#2F6FD6', ink: '#141517', muted: '#5B5E65', grid: '#D6D5CE', surface: '#FFFFFF', unsent: '#B9B8B1', heat: ['#E4E3DC', '#C9E58A', '#8DB21F', '#4A7300'] }
    : { route: '#C6F432', boulder: '#FF8A3D', blue: '#7FB2FF', ink: '#F2F1EC', muted: '#9A9CA3', grid: '#2E3035', surface: '#1A1B1E', unsent: '#4A4D54', heat: ['#25272B', '#4A5A17', '#8DB21F', '#C6F432'] };
}
