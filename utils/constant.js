const { env } = require('./env')
// 上传到的nginx服务器的路径 
const UPLOAD_PATH = env==='dev'? '/Users/Reuspect/upload/admin-upload-ebook':'C:/root/upload/admin-upload-ebook';
// 在项目中是使用这两个变量来控制上传文件存放的本地地址和线上地址,其实就是一个位置
const UPLOAD_URL = env==='dev'? 'http://book.youbaobao.xyz/admin-upload-ebook' : '123.56.195.149/admin-upload-ebook'
// 保存旧的图书封面的地址
const OLD_UPLOAD_URL = env==='dev'? 'http://book.youbaobao.xyz/book/res/img' : '123.56.195.149/book/res/img'

module.exports = {
  CODE_ERROR: -1,
  CODE_SUCCESS: 0,
  CODE_TOKEN_EXPIRED: -2, //不同的错误代码，这个是token过期错误
  debug: true,
  PWD_SALT: 'admin_imooc_node',//MD5+SALT加密 这里相当于密钥
  PRIVATE_KEY: 'admin_mooc_node_test_youbaobao_xyz', //存储在服务端的私钥
  JWT_EXPIRED: 60*60, //token失效时间
  UPLOAD_PATH,
  UPLOAD_URL,
  MIME_TYPE_EPUB: 'application/epub+zip',
  OLD_UPLOAD_URL
}