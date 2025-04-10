// index.ts
// 获取应用实例
const app = getApp<IAppOption>()

Page({
  data: {
    features: [
      {
        id: 'compress',
        name: '图片压缩',
        description: '减小图片体积，便于分享',
        icon: '/images/compress.svg'
      },
      {
        id: 'background',
        name: '抠图去背景',
        description: '一键去除图片背景',
        icon: '/images/background.svg'
      },
      {
        id: 'recognize',
        name: '图片识别',
        description: '识别图片中的文字和物体',
        icon: '/images/recognize.svg'
      },
      {
        id: 'idphoto',
        name: '证件照制作',
        description: '快速制作标准证件照',
        icon: '/images/idphoto.svg'
      }
    ]
  },

  onLoad() {
    console.log('首页加载完成')
  },

  // 导航到对应功能页面
  navigateTo(e: any) {
    const page = e.currentTarget.dataset.page
    
    // 根据点击的功能项进行页面跳转
    switch (page) {
      case 'compress':
        wx.navigateTo({
          url: '../compress/compress',
        })
        break
      case 'background':
        wx.navigateTo({
          url: '../background/background',
        })
        break
      case 'recognize':
        wx.navigateTo({
          url: '../recognize/recognize',
        })
        break
      case 'idphoto':
        wx.navigateTo({
          url: '../idphoto/idphoto',
        })
        break
      default:
        console.error('未知页面:', page)
    }
  }
})
