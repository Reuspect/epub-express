const mysql = require('mysql')
const config = require('./config')
const { debug } = require('../utils/constant')
const { isObject } = require('../utils')


function connect(){
  return mysql.createConnection({
    host:config.host,
    user:config.user,
    password:config.password,
    database:config.database,
    multipleStatements: true
  })
}

function querySql(sql){
  const conn = connect()
  debug && console.log(sql)
  return new Promise((resolve, reject)=>{
    try {
      conn.query(sql, (err, results)=>{
        if(err){
          debug && console.log('查询失败，原因：'+JSON.stringify(err))
          reject(err)
        } else {
          debug && console.log('查询成功：'+JSON.stringify(results))
          resolve(results)
        }
      })
    } catch(e){
      reject(e)
    } finally {
      // 通过connect.end方法释放连接 否则将会始终保存在内存当中 造成内存泄露
      conn.end()
    }
  })
  
}


function queryOne(sql){
  return new Promise((resolve, reject)=>{
    querySql(sql).then(results => {
      if (results && results.length > 0) {
        resolve(results[0])
      } else {
        resolve(null)
      }
    }).catch(err => {
      reject(err)
    })
  })
}

function insert(model, tableName) {
  return new Promise((resolve, reject)=>{
    if (!isObject(model)) {
      reject(new Error('插入数据库失败 插入数据非对象'))
    } else {
      const keys = []
      const values = []
      Object.keys(model).forEach(key => {
        if (model.hasOwnProperty(key)) { // 只对自身的key而不对原型对象上的key进行处理
          keys.push(`\`${key}\``) // 为了防止key与sql中的关键字冲突 比如key值为from 
          // 直接写 select from from book; 会报错 但是 select `from` from book 就没问题
          values.push(`'${model[key]}'`)
        }
      })
      if (keys.length > 0 && values.length > 0) {
        let sql = `INSERT INTO \`${tableName}\` (`
        const keysString = keys.join(',')
        const valuesString = values.join(',')
        sql = `${sql}${keysString}) VALUES (${valuesString})`
        debug && console.log(sql) // 如果是debug模式可以打印出来
        const conn = connect()
        try {
          conn.query(sql, (err, result) => {
            if(err) {
              reject(err)
            } else {
              resolve(result)
            }
          })
        } catch (e) {
          reject(e)
        } finally {
          conn.end() //连接完要释放
        }
      } else {
        reject(new Error('插入数据库失败 对象中没有任何属性'))
      }
      
    }
  })
}

function update(model, tableName, where) {
  return new Promise((resolve, reject) => {
    if (!isObject(model)) {
      reject (new Error('插入数据库失败，插入数据非对象'))
    } else {
      // insert into a,b values(c, d); update tableName set a=v1,b=v2 where;
      const entry = []
      Object.keys(model).forEach(key => {
        if(model.hasOwnProperty(key)) {
          entry.push(`\`${key}\`='${model[key]}'`)
        }
      })
      if (entry.length > 0) {
        let sql = `UPDATE \`${tableName}\` SET`
        sql = `${sql} ${entry.join(',')} ${where}`
        debug && console.log(sql) // 随时调试语句
        const conn = connect()
        try {
          conn.query(sql, (err, result) => {
            if(err) {
              reject(err)
            } else {
              resolve(result)
            }
          })
        } catch(e) {
          reject(e)
        } finally {
          conn.end() 
        }
      }
    }
  })
}

function and(where, k, v) {
  if (where === 'where') { // 考虑兼容性
    return `${where} \`${k}\`=${v}`
  } else {
    return `${where} and \`${k}\`='${v}'`
  }
}

function andLike(where, k, v) { // 
  if (where === 'where') { 
    return `${where} \`${k}\` like '%${v}%'`
  } else {
    return `${where} and \`${k}\` like '%${v}%'`
  }
}
module.exports = {
  querySql,
  queryOne,
  insert,
  update,
  and,
  andLike
}