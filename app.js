const express = require('express')
const router = require('./router')
const fs = require('fs')
const cors = require('cors')

// 创建 express 应用
const app = express()


app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use('/', router)

// 使 express 监听 5000 端口号发起的 http 请求
const server = app.listen(5000, function() {
  const { address, port } = server.address()
  console.log('Http Server is running on http://%s:%s', address, port)
})