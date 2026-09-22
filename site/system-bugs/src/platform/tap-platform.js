function requireTapApi(tapApi) {
  if (!tapApi) throw new Error('TapTap mini-game API is unavailable');
  return tapApi;
}

export class TapStorageAdapter {
  constructor(tapApi) { this.tap = requireTapApi(tapApi); }
  getItem(key) {
    const value = this.tap.getStorageSync(key);
    if (value == null || value === '') return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  setItem(key, value) { this.tap.setStorageSync(key, value); }
  removeItem(key) { this.tap.removeStorageSync?.(key); }
}

export class TapLifecycleAdapter {
  constructor(tapApi) { this.tap = requireTapApi(tapApi); }
  subscribe({ onHide, onShow } = {}) {
    if (onHide) this.tap.onHide(onHide);
    if (onShow) this.tap.onShow(onShow);
    return () => {
      if (onHide) this.tap.offHide?.(onHide);
      if (onShow) this.tap.offShow?.(onShow);
    };
  }
}

export class TapHapticsAdapter {
  constructor(tapApi) { this.tap = requireTapApi(tapApi); }
  vibrate(pattern) {
    const duration = (Array.isArray(pattern) ? pattern : [pattern]).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (duration >= 300 && typeof this.tap.vibrateLong === 'function') { this.tap.vibrateLong({}); return true; }
    if (typeof this.tap.vibrateShort === 'function') { this.tap.vibrateShort({}); return true; }
    return false;
  }
}

export class TapLoginAdapter {
  constructor(tapApi) { this.tap = requireTapApi(tapApi); }
  login() {
    if (typeof this.tap.login !== 'function') return Promise.resolve({ status: 'unavailable' });
    return new Promise(resolve => this.tap.login({
      success: result => resolve({ status: 'success', code: result?.code ?? null }),
      fail: error => resolve({ status: 'failed', error })
    }));
  }
}

export function createTapPlatform(tapApi = globalThis.tap) {
  return {
    kind: 'taptap',
    storage: new TapStorageAdapter(tapApi),
    lifecycle: new TapLifecycleAdapter(tapApi),
    haptics: new TapHapticsAdapter(tapApi),
    login: new TapLoginAdapter(tapApi)
  };
}
