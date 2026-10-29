const messages:Record<string,string>={
 UNAUTHORIZED:'请登录后重试',FORBIDDEN:'当前账号没有操作权限',INVALID_CREDENTIALS:'用户名或密码不正确',RATE_LIMITED:'操作太频繁，请稍后再试',
 TURNSTILE_FAILED:'安全验证未通过，请重新验证后提交',ORIGIN_DENIED:'请求验证失败，请刷新页面后重试',
 INVALID_BODY:'提交内容无效，请检查后重试',INVALID_INPUT:'填写的信息不符合要求',INVALID_CONTENT:'正文内容无效',
 NOT_EDITABLE:'当前帖子不能继续编辑',NOT_SUBMITTABLE:'请检查标题和正文长度',CATEGORY_NOT_FOUND:'请选择有效的社区板块',
 FILE_TOO_LARGE:'图片超过 2 MB，请压缩后重试',INVALID_FILE_SIGNATURE:'图片格式与文件内容不一致',UNSUPPORTED_MEDIA:'仅支持 PNG、JPG、WebP 图片',
 NETWORK_ERROR:'网络连接失败，请检查网络',AUTH_UNAVAILABLE:'账号服务暂不可用',CONFLICT:'内容已发生变化，请刷新后重试',
 NOT_ALLOWED:'当前状态无法操作',NOT_FOUND:'内容不存在或已被删除',DUPLICATE_USERNAME:'用户名已存在',REGISTRATION_FAILED:'注册失败，用户名可能已被占用',
};
export function friendlyError(code:string){return messages[code]||(/^(HTTP \d+)$/.test(code)?'请求失败，请稍后重试':code||'操作失败，请重试')}
