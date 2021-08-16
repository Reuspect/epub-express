const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { PRIVATE_KEY } = require('./constant')
// 注意参数需要为String类型  否则容易出错
function md5(s) {
  return crypto.createHash('md5').update(String(s)).digest('hex');
}

function decoded(req){
  // 从请求里获取token
  let token = req.get('Authorization')
  if(token.indexOf('Bearer')===0){
    token = token.replace('Bearer ','')
  }
  return jwt.verify(token, PRIVATE_KEY)
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) == '[object Object]' // 检测obj是否为对象的方法,可以精确的判断数据类型
}
 
module.exports = {
  md5,
  decoded,
  isObject
}