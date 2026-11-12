import { describe, expect, it } from 'vitest';
import { uniquePageName } from './page-names';

describe('uniquePageName (seen live: re-import created a second "Design system" page)', () => {
  it('keeps free names and numbers taken ones', () => {
    expect(uniquePageName('Home', ['Page 1'])).toBe('Home');
    expect(uniquePageName('Design system', ['Design system'])).toBe('Design system (2)');
    expect(uniquePageName('Design system', ['Design system', 'Design system (2)'])).toBe('Design system (3)');
  });
});
