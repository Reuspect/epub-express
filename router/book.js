const express = require('express')
// 用于文件上传的中间件
const multer = require('multer')
const Result = require('../models/Result')
const { UPLOAD_PATH } = require('../utils/constant')
const Book = require('../models/Book')
const boom = require('boom')
const { decoded } = require('../utils')
const bookService = require('../services/book')

const router = express.Router()


router.post(
  '/upload', 
  multer({ dest: `${UPLOAD_PATH}/book` }).single('file'), 
  function(req,res,next) {
    // req.file就可以获取文件
    if(!req.file || req.file.length === 0) {
      new Result('上传电子书失败').fail(res)
    } else {
      let book = new Book(req.file)
      book.parse().then(book => {
        // console.log('resolve过来的book', book)
        new Result(book, '上传电子书成功').success(res)
      }).catch(err=>{
        // 这个方法可以向前端返回500错误
        next(boom.badImplementation(err))
      }) 
      
    }
})


router.post('/create', function(req, res, next){
  const decode = decoded(req) //回忆 传入req可以从token中解析出username
  // console.log(req.body) //解析出来的formdata
  if (decode && decode.username) {
    req.body.username = decode.username //给要存入数据库的book对象添加username属性
  }
  const book = new Book(null, req.body) // Book的构造函数允许传入file或者data两种形式
  // console.log(book)
  bookService.insertBook(book).then(()=>{
    new Result('添加电子书到数据库成功').success(res)
  }).catch(err => {
    next(boom.badImplementation(err)) // insertBook报的错就会传到这里再传下去给中间件
  })
})

router.post('/update', function(req, res, next){
  const decode = decoded(req) //传入req可以从token中解析出username
 
  if (decode && decode.username) {
    req.body.username = decode.username //给要存入数据库的book对象添加username属性
  }
  const book = new Book(null, req.body) // Book的构造函数允许传入file或者data两种形式
  
  bookService.updateBook(book).then(()=>{
    new Result('更新电子书到数据库成功').success(res)
  }).catch(err => {
    next(boom.badImplementation(err)) // insertBook报的错就会传到这里再传下去给中间件
  })
})

router.get('/get', function(req, res, next) {
  const { fileName } = req.query //从请求参数中获取
  if(!fileName) {
    next(boom.badRequest(new Error('参数fileName不能为空'))) // 返回一个400错误 
  } else {
    bookService.getBook(fileName).then(book => {
      new Result(book, '获取图书信息成功').success(res)
    }).catch(err => {
      next(boom.badImplementation(err)) //通常是代码错误
    })
  }
})

router.get('/category', function(req, res, next) {
  bookService.getCategory().then(category => {
    new Result(category, '获取分类成功').success(res)
  }).catch(err => {
    next(boom.badImplementation(err))
  })
})

router.get('/list', function(req, res, next) {
  bookService.listBook(req.query).then(({ list, count, page, pageSize }) => {
    new Result({ list, count, page, pageSize } ,'获取图书列表成功').success(res)
  }).catch(err => {
    next(boom.badImplementation(err))
  })
})

router.get('/delete', function(req, res, next) {
  const { fileName } = req.query
  if(!fileName) {
    next(boom.badRequest(new Error('参数fileName不能为空')))
  } else {
    bookService.deleteBook(fileName).then(()=>{
      new Result('删除图书信息成功').success(res)
    }).catch((err)=>{
      next(boom.badImplementation(err))
    })
  }
  
})

module.exports = router