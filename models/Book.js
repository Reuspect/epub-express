const { MIME_TYPE_EPUB, UPLOAD_URL, UPLOAD_PATH, OLD_UPLOAD_URL } = require('../utils/constant')
const fs = require('fs')
const path = require('path')
const Epub = require('../utils/epub')
const xml2js = require('xml2js').parseString
const { resolve } = require('path')

class Book {
  constructor(file, data) {
    if (file) {
      this.createBookFromFile(file)
    } else {
      this.createBookFromData(data)
    }
  }

  createBookFromFile(file) {
    console.log('createBookFromFile', file)
    const { destination, filename, mimetype=MIME_TYPE_EPUB, path, originalname } = file
    // 电子书的文件后缀名
    const suffix = mimetype === MIME_TYPE_EPUB ? '.epub': ''
    // 电子书原有的文件路径 '\\Users\\Reuspect\\upload\\admin-upload-ebook\\book\\134032132ce360e457944a8de35f470b'
    const oldBookPath = path
    // 电子书新的文件路径 '/Users/Reuspect/upload/admin-upload-ebook/book' '134032132ce360e457944a8de35f470b' '.epub'
    const bookPath = `${destination}/${filename}${suffix}`
    // 由于文件已经处在nginx当中 只需要提供一个upload的url 生成文件的下载url路径
    const url = `${UPLOAD_URL}/book/${filename}${suffix}`
    // 解压路径 使用upload_path获取在操作系统里的路径 电子书解压后的文件夹路径
    const unzipPath = `${UPLOAD_PATH}/unzip/${filename}`
    // 解压url 使用upload_path获取在操作系统里的路径 电子书解压后的文件夹url
    const unzipUrl = `${UPLOAD_URL}/unzip/${filename}`
    if(!fs.existsSync(unzipPath)) {
      // 在上传一本电子书后如果电子书解压路径不存在时 就迭代创建这个文件夹
      fs.mkdirSync(unzipPath, { recursive: true })
    }
    if(fs.existsSync(oldBookPath) && !fs.existsSync(bookPath)) {
      fs.renameSync(oldBookPath, bookPath)
    }
    this.fileName = filename //文件名  e01f20392be31cb6059c92cb06e5fd70
    // 不包含destination 因为客户端和服务端的路径可能不一致 这里是相对路径
    this.path = `/book/${filename}${suffix}` //epub文件相对路径  /book/b00511525acbc837236e35b060af47be.epub
    this.filePath = this.path //别名
    this.unzipPath = `/unzip/${filename}` // epub解压后相对路径 /unzip/b00511525acbc837236e35b060af47be
    this.url = url //电子书的保存地址 epub文件的下载链接 'http://book.youbaobao.xyz/admin-upload-ebook/book/b00511525acbc837236e35b060af47be.epub
    this.title = '' // 电子书解析后的标题或书名
    this.author = '' // 作者
    this.publisher = '' // 出版社
    this.contents = [] // 目录
    this.contentsTree = [] // 树状目录结构
    this.cover = '' //封面图片url
    this.coverPath = '' //封面图片路径
    this.category = -1 //分类ID
    this.categoryText = '' //分类名称
    this.language = '' // 语种
    this.unzipUrl = unzipUrl // 解压后的文件夹链接(阅读电子书时候用)
    this.originalName = originalname
    
  }
  createBookFromData(data) {
    // console.log('createBookFromdata', data)
    this.fileName = data.fileName
    this.cover = data.coverPath
    this.author = data.author
    this.title = data.title
    this.publisher = data.publisher
    this.bookId = data.fileName
    this.language = data.language
    this.rootFile = data.rootFile
    this.originalName = data.originalName
    this.path = data.path || data.filePath
    this.filePath = data.path || data.filePath
    this.unzipPath = data.unzipPath
    this.coverPath = data.coverPath
    this.createUser = data.username
    this.createDt = new Date().getTime() //新建时间戳
    this.updateDt = new Date().getTime()
    this.updateType = data.updateType === 0 ? data.updateType : 1 // 0表示默认图书 1表示来源于互联网？
    this.category = data.category || 99 // 可以由用户在前端输入 没传就归类为自定义
    this.categoryText = data.categoryText || '自定义'
    this.contents = data.contents || []
  }

  parse() {
    return new Promise((resolve, reject) => {
      const bookPath = `${UPLOAD_PATH}${this.filePath}`
      if (!fs.existsSync(bookPath)) {
        reject(new Error('电子书不存在'))
      }
      const epub = new Epub(bookPath)
      epub.on('error', err=>{
        reject(err)
      })
      epub.on('end', err=>{
        if (err) {
          reject(err)
        } else {
          // console.log('epub end中这里打印的是epub', epub.metadata)
          const {
            language,
            creator,
            creatorFileAs,
            title,
            cover,
            publisher
          } = epub.metadata
          if (!title) {
            reject(new Error('图书标题为空'))
          } else {
            this.title = title
            this.language = language || 'en'
            this.author = creator || creatorFileAs || 'unknown'
            this.publisher = publisher || 'unknown'
            this.rootFile = epub.rootFile
            const handleGetImage = (err, file, mimeType) => {
              // 打印出来可以知道 file目前还是buffer对象 后面需要转为文件 现在存在了内存当中
              // console.log(err, file,mimeType)
              if(err){
                reject(err)
              } else {
                // 拼出一个名字出来
                const suffix = mimeType.split('/')[1]
                const coverPath = `${UPLOAD_PATH}/img/${this.fileName}.${suffix}`
                const coverUrl = `${UPLOAD_URL}/img/${this.fileName}.${suffix}`
                // 把buffer写入到磁盘当中 写在哪儿 写的什么, 写成什么类型
                fs.writeFileSync(coverPath, file, 'binary')
                this.coverPath = `/img/${this.fileName}.${suffix}`
                this.cover = coverUrl
                resolve(this) //等待整个电子书解析完再调用
              }
            }
            try {
              this.unzip() //先解压 最后获取image 出错会由adm-zip抛出filename不存在的异常
              this.parseContent(epub).then(({chapters, chapterTree}) => {
                this.contents = chapters
                this.contentsTree = chapterTree
                epub.getImage(cover, handleGetImage)
              }) // 传入epub对象才能解析嘛              
              
            } catch (e) {
              reject(e)
            }
            
          }
          
        }
      })
      epub.parse()
    })
    
  }

  unzip() {
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(Book.genPath(this.path)) //传入电子书路径(绝对路径)即可
    // 将解压好的文件放到某个路径下 true代表进行覆盖
    zip.extractAllTo(Book.genPath(this.unzipPath), true)
  }

  parseContent(epub) {
    function getNcxFilePath() {
      const spine = epub && epub.spine
      // console.log('spine', spine)
      const ncx = spine.toc && spine.toc.href //'OEBPS/toc.ncx',
      const id = spine.toc && spine.toc.id //'ncx'
      if(ncx) {
        return ncx
      } else {
        return manifest[id].href //OEBPS/toc.ncx
      }
    }

    function findParent(array, level=0, pid= '') {
      return array.map(item => {
        item.level = level
        item.pid = pid
        if (item.navPoint && item.navPoint.length > 0) { //navPoint是一个数组
          item.navPoint = findParent(item.navPoint, level+1, item['$'].id)
        } else if (item.navPoint) { //如果navPoint是一个对象(只有一个目录)
          item.navPoint.level = level+1
          item.navPoint.pid = item['$'].id
        }
        return item
      })
    }

    function flatten(array) {
      return [].concat(...array.map(item => {
        if (item.navPoint && item.navPoint.length > 0) { //如果下面有子目录数组的存在
          return [].concat(item, ...flatten(item.navPoint)) //借助展开运算符的方式生成新的数组,新的数组也会因为上面的展开运算符而被铺平进入新的数组
        } else if (item.navPoint) {
          return [].concat(item, item.navPoint)
        }
        return item //item正常都是对象
      }))
    }
    return new Promise((resolve, reject)=>{
      const ncxFilePath = Book.genPath(`${this.unzipPath}/${getNcxFilePath()}`) // 生成绝对路径
      // console.log('ncxFilePath', ncxFilePath)
      // 判断文件路径存在与否
      if(fs.existsSync(ncxFilePath)) {
        const xml = fs.readFileSync(ncxFilePath, 'utf-8')
        const dir = path.dirname(ncxFilePath).replace(UPLOAD_PATH, '') //获取文件所在的文件夹路径 /Users/Reuspect/upload/admin-upload-ebook/unzip/d0cead73daf54e5f59332f590715dab7/OEBPS
        // 承上，注意 这里获取我们是为了拼出可以访问chapter内容的url 所以/unzip前面的部分(也就是UPLOAD_PATH)我们希望能换成UPLOAD_URL
        
        const unzipPath = this.unzipPath
        const fileName = this.fileName
        // 借助xml2js库通过json.ncx.navMap获取核心部分
        xml2js(xml, {
          // 配置
          explicitArray: false, //去掉解析时最外层包裹的数组
          ignoreAttrs: false, //默认解析属性?
        }, function(err, json) {
          if(err) {
            reject(err)
          } else {
            
            const navMap = json.ncx.navMap
            // console.log('xml', navMap)
            // console.log('xml', JSON.stringify(navMap))
            if (navMap.navPoint && navMap.navPoint.length > 0) {
              navMap.navPoint = findParent(navMap.navPoint)
              // console.log('navPoint', navMap.navPoint)
              const newNavMap = flatten(navMap.navPoint) //把树状结构变成一维结构 不会改变原来的值
              const chapters = []
              // console.log('newNavMap', newNavMap)
              // console.log('epubflow',epub.flow)
              // newNavMap完全是目录当中的信息 epub.flow代表的是章节的阅读顺序? epub.flow大一点
              newNavMap.forEach((chapter, index) => {
                // nav = newNavMap[index] 由于不用epub.flow.forEach了 所以就不用判断nav了 
                const src = chapter.content['$'].src
                chapter.text = `${UPLOAD_URL}${dir}/${src}` //给章节添加一个text属性保存其xhtml文件的绝对路径
                //这两项是为了满足插入数据库需要而新增的
                chapter.id = `${src}`
                chapter.href = `${dir}/${src}`.replace(unzipPath, '')
                
                chapter.label = chapter.navLabel.text || ''                
                chapter.navId = chapter['$'].id
                chapter.fileName = fileName
                chapter.order = index + 1
                chapters.push(chapter)
              })
              // const chapterTree = []
              // // console.log('chapters',chapters)
              // chapters.forEach(c => {
              //   c.children = []
              //   if (c.pid === '') {//说明当前是一级目录
              //     chapterTree.push(c)
              //   } else {
              //     const parent = chapters.find(_ => _.navId === c.pid) //借助find和navId找自己的父级
              //     // if(!parent.children){
              //     //   parent.children = []
              //     // }
              //     parent.children.push(c)
              //   }
              // })
              // // console.log(chapterTree)
              const chapterTree = Book.genContentsTree(chapters)
              resolve({chapters, chapterTree})
            } else {
              reject(new Error('目录解析失败, 目录数为0'))
            }
          }
        })
      } else {
        throw new Error('目录文件不存在')
      }
    })
    
  
  }

  toDb() { //导出可以存在数据库中的数据
    return {
      fileName : this.fileName,
      cover : this.coverPath,
      author : this.author,
      title : this.title,
      publisher : this.publisher,
      bookId : this.fileName,
      language : this.language,
      rootFile : this.rootFile,
      originalName : this.originalName,
      filePath : this.filePath,
      unzipPath : this.unzipPath,
      coverPath : this.coverPath,
      createUser : this.createUser,
      createDt : this.createDt, 
      updateDt : this.updateDt,
      updateType : this.updateType,
      category : this.category,
      categoryText : this.categoryText 
    }
  }

  getContents() { //借助方法专门返回contents先做逻辑处理
    return this.contents
  }

  reset() { //文件 封面 解压文件是否存在
    if (Book.pathExists(this.filePath)) {
      console.log('删除文件')
      fs.unlinkSync(Book.genPath(this.filePath)) //借助fs.unlinksync删除单文件
    }
    if (Book.pathExists(this.coverPath)) {
      console.log('删除封面')
      fs.unlinkSync(Book.genPath(this.coverPath))
    }
    if (Book.pathExists(this.unzipPath)) {
      console.log('删除解压目录')
      fs.rmdirSync(Book.genPath(this.unzipPath), { recursive: true }) //进行文件夹的迭代删除
    }
  }

  static pathExists(path) {
    if (path.startsWith(UPLOAD_PATH)) {
      return fs.existsSync(path)
    } else {
      return fs.existsSync(Book.genPath(path))
    }
  }

  static genPath(path) {
    // 从相对路径生成绝对路径 对可能多写的'/'进行兼容性处理
    if(!path.startsWith('/')) {
      path = `/${path}`
    }
    return `${UPLOAD_PATH}${path}`
  }

  static getCoverUrl(book) { // 考虑老的电子书url
    const {cover} = book
    console.log('book的cover是', cover)
    if(+book.updateType === 0) {
      
      if (cover) {
        if (cover.startsWith('/')) { // 做一个兼容
          return `${OLD_UPLOAD_URL}${cover}`
        } else {
          return `${OLD_UPLOAD_URL}/${cover}`
        }
      } else {
        return null
      }
    } else {
      if (cover) {
        if (cover.startsWith('/')) { // 做一个兼容
          return `${UPLOAD_URL}${cover}`
        } else {
          return `${UPLOAD_URL}/${cover}`
        }
      } else {
        return null
      }
    }
  }

  static genContentsTree(contents) {
    
    if (contents) {
      const contentsTree = []
      // console.log('chapters',chapters)
      contents.forEach(c => {
        c.children = []
        if (c.pid === '') {//说明当前是一级目录
          contentsTree.push(c)
        } else {
          const parent = contents.find(_ => _.navId === c.pid) //借助find和navId找自己的父级
          // if(!parent.children){
          //   parent.children = []
          // }
          parent.children.push(c)
        }
      })
      return contentsTree
    }
  }
}

module.exports = Book