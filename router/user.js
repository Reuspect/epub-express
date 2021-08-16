const express = require('express')
const Result = require('../models/Result')
const { login, findUser } = require('../services/user')
const { PWD_SALT } = require('../utils/constant')
const { md5, decoded } = require('../utils/index')
const { body, validationResult } = require('express-validator')
const boom = require('boom')
// 生成token
const jwt = require('jsonwebtoken')
const { PRIVATE_KEY, JWT_EXPIRED } = require('../utils/constant')

const router = express.Router()

router.post('/login', [
  body('username').isString().withMessage("用户名必须为字符"),
  body('password').isString().withMessage("密码必须为字符")
],
function(req, res, next){
  let err = validationResult(req)
  if(!err.isEmpty()){
    // const msg = err.errors[0].msg
    // 数组+对象结构的方式如下
    let [{msg}] = err.errors
    // 借助boom 传递给下一个中间件执行 badRequest代表400错误 请求参数出现了异常
    next(boom.badRequest(msg))
  }
  // console.log(req.body)
  let { username, password } = req.body;

  // 把传进来的密码加密
  password = md5(`${password}${PWD_SALT}`)
  // querySql( 'select * from admin_user').then(results=>{
  //   // console.log(results)
  // })
  // 下面的login函数封装了querysql语句
  login(username, password).then(user=>{
    if(!user || user.length === 0){
      new Result('登陆失败').fail(res)
    } else {
      // 生成token并传递给result
      const token = jwt.sign(
        { username },
        PRIVATE_KEY,
        { expiresIn: JWT_EXPIRED }
      )
      new Result({ token }, '登陆成功').success(res)
    }
  })
  // if( username == 'admin' && password =='111111'){
  //   new Result('登陆成功').success(res)
  // } else {
  //   new Result('登陆失败').fail(res)
  // }
    
})
router.get('/info', function(req, res, next) {
  const decode = decoded(req)
  // console.log(decode)
  findUser(decode.username).then(user => {
    // console.log(user)
    // 考虑一下user不存在的情况
    if(user){
      user.roles = [user.role]
      new Result(user, '用户信息查询成功').success(res)
    } else{
      new Result('用户信息查询失败').fail(res)
    }
  })
})

module.exports = router