// 全局对象：Chrome 61（小红书最低兼容的 Android 8.1 出厂 WebView）没有 globalThis，直接写会抛 ReferenceError。
// typeof 判断未声明的变量不会报错；不用 Function('return this')，小工具容器禁止动态执行代码。
declare const GameGlobal: any;
export const GLOBAL: any =
  typeof globalThis !== 'undefined' ? globalThis
    : typeof GameGlobal !== 'undefined' ? GameGlobal
      : typeof window !== 'undefined' ? window
        : typeof self !== 'undefined' ? self
          : {};
