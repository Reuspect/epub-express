const Book = require('../models/Book')
const db = require('../db')
const _ = require('lodash')
const {debug} = require('../utils/constant')

function exists(book) { // 判断书是否已经存在
  const { title, author, publisher} = book
  const sql = `select * from book where title='${title}' and author='${author}' and publisher='${publisher}'`
  return db.queryOne(sql)
}

async function removeBook(book) {
  if(book) {
    book.reset() //把电子书相关的文件给删除
    if(book.fileName) {
      const removeBookSql = `delete from book where fileName='${book.fileName}'`
      const removeContentsSql = `delete from contents where fileName='${book.fileName}'`
      await db.querySql(removeBookSql)
      await db.querySql(removeContentsSql)
    }//把数据库中的信息也删除
  } 
}

async function insertContents(book) {
  const contents = book.getContents()
  // console.log('contents', contents)
  if(contents && contents.length >0) {
    // contents里的字段要多余数据库的要求。我们可以直接新建对象依次赋值 
    // 或者lodash lodash是一系列类库的集合 使用时用_来调用
    for (let i = 0; i <contents.length; i++) {
      const content = contents[i] // 每一个目录项
      const _content = _.pick(content, [
        'fileName',
        'id',
        'href',
        'text',
        'order',
        'level',
        'label',
        'pid',
        'navId'
      ]) //选择性插入的字段 （一开始没有id和href 需要在Book.js中手动添加内容
      console.log('_content', _content)
      await db.insert(_content, 'contents') //数据合规 就可以插入数据库里
    }
  }
}

function insertBook(book) {
  return new Promise(async (resolve, reject) => { //这里使用了async await是因为大量使用到了数据库调用的方法 需要写很多个promise 所以用await来控制顺序
    try { //用try catch来控制错误出现时的处理
      if (book instanceof Book) { // 如果是实例可以能保证参数是完备的
        const result = await exists(book) //首先判断该电子书在数据库中是否存在
        // const result = false
        if (result) {
          await removeBook(book) // 在服务端将文件移除 数据库的记录移除
          reject(new Error('电子书已存在'))
        } else {
          await db.insert(book.toDb(), 'book') //传入对象，传入一个表名
          await insertContents(book) // 电子书的目录传入进去(数据库中contents表示电子书目录表)
          resolve()
        }
      } else {
        reject(new Error('添加的图书对象不合法'))
      }
    } catch (e) {
      reject (new Error('添加的图书对象不合法'))
    }
  })
}

function updateBook(book) {
  return new Promise(async (resolve, reject) => {
    try {
      if (book instanceof Book) {
        const result = await getBook(book.fileName) // 上传来的book信息是不完全的 我们想获取到完整的信息就要调用一次查询数据库
        // console.log(result)
        if (result) { // 若原书在数据库中确实存在
          const model = book.toDb() // 把要更新的书的信息转成可以输入给数据库的形式
          if (+result.updateType === 0) {
            reject(new Error('内置图书不能编辑'))
          } else {
            await db.update(model, 'book', `where fileName='${book.fileName}'`)
            resolve()
          }
        }
      } else {
        reject(new Error('添加的图书对象不合法'))
      }
    } catch (e) {

    }
  })
}

function getBook(fileName) {
  return new Promise(async (resolve, reject)=>{
    // 首先做book和contents表的查询
    const bookSql = `select * from book where fileName='${fileName}'`
    const contentsSql = `select * from contents where fileName='${fileName}' order by \`order\` `
    const book = await db.queryOne(bookSql)
    const contents = await db.querySql(contentsSql)
    if(book) {
      book.cover = Book.getCoverUrl(book)
      book.contentsTree = Book.genContentsTree(contents)
      resolve(book)
    } else {
      reject(new Error('电子书不存在'))
    }
    
  })
}

async function getCategory() {
  const sql = `select * from category order by category asc`
  const result = await db.querySql(sql)
  const categoryList = []
  result.forEach(item => {
    categoryList.push({
      label: item.categoryText,
      value: item.category,
      num: item.num,
    })
  })
  return categoryList
}

async function listBook(query) {
  debug && console.log(query)
  const { 
    category,
    author,
    title,
    page = 1,
    pageSize = 20,
    sort = "+id"
  } = query
  const offset = (page-1)*pageSize // 设置偏移量
  let bookSql = 'select * from book'
  let where = 'where'
  // 查询部分（精确&模糊）
  title && (where = db.andLike(where, 'title', title)) 
  author && (where = db.andLike(where, 'author', author)) 
  category && (where = db.and(where, 'category', category)) // 也好理解 有category的情况下用db.and方法生成对应的sql语句
  
  if (where !== 'where') { // 有查询条件时
    bookSql =  `${bookSql} ${where}`
  }
  // 排序方式
  if(sort) {
    const symbol = sort[0] // 取一个字符的方法类似于数组
    const column = sort.slice(1, sort.length)
    const order = symbol === '+' ? 'asc': 'desc'
    bookSql = `${bookSql} order by \`${column}\` ${order}`
  }

  // 统计电子书数量 做分页查询
  let countSql = `select count(*) as count from book`
  if (where !== 'where') {// 有查询条件时
    countSql = `${countSql} ${where}`
  }
  const count = await db.querySql(countSql) // 查询结果[{"count": 464}]这样的格式
  // 最后合成的sql语句
  bookSql = `${bookSql} limit ${pageSize} offset ${offset}`
  const list = await db.querySql(bookSql)
  list.forEach(book => book.cover = Book.getCoverUrl(book)) // 为了让老电子书也能生成cover的url
  // return { list } async函数如果返回的不是promise会自动变成promise
  return new Promise((resolve, reject) => {
    resolve({list, count: count[0].count, page: +page,  pageSize: +pageSize}) // 返回数字类型
  })
}

function deleteBook(fileName) {
  return new Promise(async (resolve, reject)=>{
    let book = await getBook(fileName) // getbook可以快速拿到电子书的信息
    if (book) {
      if (+book.updateType === 0) {
        reject(new Error('内置电子书不能删除'))
      } else {
        const bookObj = new Book(null, book)
        const sql = `delete from book where fileName='${fileName}'`
        db.querySql(sql).then(() => {
          bookObj.reset()
          resolve()
        })
      }
    } else {
      reject(new Error('电子书不存在'))
    }
    resolve()
  })
}

module.exports = {
  insertBook,
  getBook,
  updateBook,
  getCategory,
  listBook,
  deleteBook
}