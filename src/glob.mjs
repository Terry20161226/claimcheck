// 极简 glob 匹配：支持 **（跨目录）、*（段内）、?（单字符）、前缀目录写法 "src/**"。
// 刻意不引入依赖；只覆盖授权范围声明所需的语义。

const escapeRe = (s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');

function toRegex(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // "**/" 可匹配零层目录，"**" 结尾匹配任意后缀
        if (glob[i + 2] === '/') { re += '(?:[^/]+/)*'; i += 3; }
        else { re += '.*'; i += 2; }
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else {
      re += escapeRe(c);
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchGlob(glob, path) {
  return toRegex(glob).test(path);
}

export function matchAnyGlob(globs, path) {
  return globs.some((g) => matchGlob(g, path));
}
