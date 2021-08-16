const expressJwt = require('express-jwt')
const { PRIVATE_KEY } = require('../utils/constant')

// 用来解析认证req.header里携带传来的token的
const jwtAuth = expressJwt({
  secret: PRIVATE_KEY,
  credentialsRequired: true,
  algorithms: ['HS256'] //和文档不一样 这个要有
}).unless({
  path: [
    '/',
    '/user/login'
  ], //设置jwt认证白名单
});
// 要在中间件 调用路由之前 来调用jwtAuth

module.exports = jwtAuth;