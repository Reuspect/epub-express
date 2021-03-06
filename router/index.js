const express = require('express')
const boom = require('boom')
const userRouter = require('./user')
const bookRouter = require('./book')

const { CODE_ERROR } = require('../utils/constant')
const jwtAuth = require('../router/jwt')
const Result = require('../models/Result')

const router = express.Router()
// 这里router的主要作用是处理路由的监听

// 在所有路由之前先设置jwtAuth中间件
router.use(jwtAuth)

router.get('/', function(req, res){
  res.send('欢迎来到一起读书管理后台')
})

// /user是前缀 /user/info这样才能访问到接口
router.use('/user', userRouter)

router.use('/book', bookRouter)
/**
 * 集中处理404请求的中间件 不是异常处理中间件 是正常的中间件
 * 注意：该中间件必须放在正常处理流程之后
 * 否则，会拦截正常请求
 */
router.use((req, res, next)=>{
  next(boom.notFound('接口不存在'))
})


/**
 * 自定义路由异常处理中间件
 * 注意两点：
 * 第一，方法的参数不能减少
 * 第二，方法的必须放在路由最后
 */
router.use((err, req, res, next) => {
  // console.log(err)
  if(err.name && err.name === 'UnauthorizedError'){
    const { status=401, message } = err //错误代码
    // console.log(res)
    new Result(null, 'Token验证失败', {
      error: status,
      errMsg: message
    }).jwtError(res.status(status))
  } else {
    const msg = (err && err.message) || '系统错误'
    const statusCode = (err.output && err.output.statusCode) || 500;
    const errorMsg = (err.output && err.output.payload && err.output.payload.error) || err.message
    new Result(null, msg, {
      error: statusCode,
      errorMsg
    }).fail(res.status(statusCode))
    // res.status(statusCode).json({
    //   code: CODE_ERROR,
    //   msg,
    //   error: statusCode,
    //   errorMsg
    // })
  }
  
})


module.exports = router