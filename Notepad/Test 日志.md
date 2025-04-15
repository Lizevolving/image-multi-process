












## 4.15，707，调试：

1. Compress页面
“compressLevelOptions”，修改相应的console.log,和用户端的命名显示，用户无法准确理解4个尺度。

2. recognize页面
在识别上传的“加载中”页面，会出现两个spinner，一个是微信原生的，一个是我们自己设置的，只保留前者。


wx.getSystemInfoSync is deprecated.Please use wx.getSystemSetting/wx.getAppAuthorizeSetting/wx.getDeviceInfo/wx.getWindowInfo/wx.getAppBaseInfo instead.
onLoad @ crop.ts:55
[pages/crop/crop] [Component] <canvas>: canvas 2d 接口支持同层渲染且性能更佳，建议切换使用。详见文档 https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html#Canvas-2D-%E7%A4%BA%E4%BE%8B%E4%BB%A3%E7%A0%81

3. BackgroundService.ts问题

是什么问题？
从选择图片成功的路径，到抠图成功的结果路径，图片均为空白。
图片在传输/处理过程中丢失，可能是：
临时文件被系统自动清理（如微信/浏览器临时路径）
API返回了空数据但状态码仍为200
本地存储路径权限不足导致文件写入失败

为什么？根源分析：
临时文件失效：http://tmp/...路径通常是系统临时目录，可能处理后立即被清除
API响应异常：虽然状态码200，但可能返回了错误（如额度不足但未触发错误状态）
路径权限问题：http://usr/路径可能无写入权限或为虚拟路径

怎么做？
短期验证：
检查API返回的原始数据：在backgroundService.ts:228处打印response.data，确认是否为有效图片二进制
替换真实存储路径：如改用FileSystem API或IndexedDB存储文件

长期最佳实践：
文件生命周期管理：
避免依赖临时路径，改用Blob URL或持久化存储
显式清理文件（如URL.revokeObjectURL()）

API健壮性：
校验返回数据的Content-Length和Content-Type
捕获response.data异常（如空数据）

日志增强：
记录文件大小（压缩前/后、API返回后）
关键操作添加try-catch并输出错误详情

最关键点：数据流验证
不要依赖路径和状态码，逐步验证：
原始图片 → 2. 压缩后二进制 → 3. API返回数据 → 4. 最终存储文件
在每个环节检查数据是否存在且有效（如console.log(data.length)）

避免纠结手段：

目标导向：目的是获取可用的去背景图片，而非“路径是否生成”。直接检查：
javascript
// 在抠图成功后立即加载图片验证
const img = new Image();
img.onload = () => console.log("图片有效");
img.onerror = () => console.log("图片损坏");
img.src = "http://usr/bg_removed_1744672755231.png";
如果onerror触发，说明问题在数据流；否则问题在UI显示环节。










## 736，调试：
1. Compress页面
实现粗粒度选择的、节点式的滑块slider，而不是radio-group替代。
压缩结束后，“开始压缩”按钮仍然存在。

2. recognize页面
上传图片区域，图片预览区域。自定义提示输入区域。三区域位置往上移，调整为适宜形式。
对于处理好了的content常量，支持复制。在旁边设置好复制按钮。

3. Background页面
页面以及相应的函数，功能依旧无法实现，且仍未在关键位置添加console.log。



## 4.13，657，调试：

1/ Compress页面
开始压缩时，比率调节的名字和下方压缩后的显示的“压缩率”。
两者相反，也就是说用需要潜在动脑计算，不是好实践。
措施：上方slider，改成颗粒度更粗的设计，只有固定节点处有，名字更改为“压缩程度”。
compress页面下方提示始终以灰色小字形式固定在最下方。

2/ Background页面
扣背景功能没有实现。最后生成的图片，既无背景也无主体。
并且，Background service工具文件以及Background.ts文件中,仅有一处console.log.
让我无法定位问题。

3/ Recognize页面
#FF9800，将页面主题色改为此颜色。（目前发现此页面中，最上方navigation bar是绿，与此颜色不符）

4/ Crop页面
裁剪时，若直接点击左上方小程序原生返回按钮，或者进行了右滑操作，则会跳转到证件照制作的空白页面（无任何信息，只有证件照制作的title标识）
最佳实践：用户在裁剪时，若点击了左上角返回按钮，则退回到证件照制作原始页面。
Crop页面中，裁剪白框无法移动或缩放。

5/ idphoto页面
“图片处理中”页面，过长。
理想情况：等待的第10秒时，给到耐心提示；15秒时，强制退出，返回初始页面。

将所有的API调用，都调整为此time out机制（idphoto、Background页面有对remove的API调用）
之前已经设置过初步的，现在请将他们调整为同一机制。



## 4.11  1114-1142  真机调试

1/ （不仅subtitle是多余的）各具体页面的title也多余。微信原生微信小程序上方，原生navigationbar处，就有页面名字。


2/ Compress页面
十分反人性设计：开始压缩时，比率调节的名字是“压缩级别”。下方压缩后的结果又显示的是，“压缩率”。两者相反，也就是说用需要潜在动脑计算，不是好实践。
改成颗粒度更粗的slide的设计，只有几个节点处有。

查看压缩前后两张图片时，发现size无变化，即压缩动作并没有完成。但从始至终并没有给到提示，也就是说用户被蒙骗了。
Compress.ts 141行，handleCompressionError() “// 模拟压缩 - 如果Canvas压缩失败，退回到简单模拟”
这是谁做出来的蠢函数，故意哄骗用户吗？没成功肯定要指出，这道理还需要说吗？

报错提示台报错如下:究竟是压缩失败，还是没能将压缩好的图片导出（以至于只能导出原图）？
导出图片失败 {errMsg: "canvasToTempFilePath:fail :create bitmap failed"}errMsg: "canvasToTempFilePath:fail :create bitmap failed"constructor: (...)hasOwnProperty: (...)isPrototypeOf: (...)propertyIsEnumerable: (...)toLocaleString: (...)toString: (...)valueOf: (...)__defineGetter__: (...)__defineSetter__: (...)__lookupGetter__: (...)__lookupSetter__: (...)[[Prototype]]: Object
fail @ compress.ts:130
compress.ts:130 导出图片失败 {errMsg: "canvasToTempFilePath:fail :create bitmap failed"}

甚至在仔细研究了手机上的相册之后，会发现compress同样是伪需求。
相册中，针对于单个照片，点击第4个按钮“关于（more）”可以看到compress size（压缩）小按钮。
这样功能的小程序、APP居然还有市场，只能是因为用户的愚蠢、不仔细观察。

2/ Background页面

抠图效果无法实现，生成的是空白图片，既无背景，也无主体。
在此过程中，控制台报告如下所示。(所以并非其他方process问题，而是我们这边的响应问题，是吗？)

抠图去背景页面加载
VM75:407 error occurs:no such file or directory, unlink 'wxfile://usr/temp_1744341672340.png' p @ VM75:407
(anonymous) @ VM75:407
(anonymous) @ node:fs:181
appservice.app.js:160 清理临时文件失败 {errMsg: "unlink:fail no such file or directory, unlink 'wxfile://usr/temp_1744341672340.png'", errno: 1300002}


3/ Recognize页面

主题色仍然为绿色。理想情况：与recognize.svg同色的橙色。（请先查看此svg的颜色型号后，去recognize的WXSS文件修改）
上传图片的部件位于最下方。理想情况是处于上方。



4/ 进度条和“今日可用”的提示
将其删去，Background、recognize、idphoto三页面都有这些显示，都删去，最后只需要留下“使用10次，20次，30次时”给到的提示。
“如果一个元素用户10秒内用不到，就隐藏或删除”


5/ API响应，等待机制
图片识别页面，处理过程中，识别的耗时过长。
理想情况：等待的第10秒时，给到耐心提示；15秒时，强制退出，返回初始页面。

将所有的API调用，都调整为此time out机制（idphoto、Background页面有对remove的API调用）
之前已经设置过初步的，现在请将他们调整为同一机制。

6/ 传给AI的提示词
同样需要优化。让他生成“丝滑流畅的纯文本，不需要列点式”，无需死板的对应每个角度，而是系统整合的文段。且当该角度无相应的信息时，无需显性地说出来。
（显得很呆，像机器人）


7/ 证件照制作页面

初始页面，三个标准选择之间，间隔再拉大。

结束页面，最下方的提示删掉，属冗余内容。
点击“更换背景色”按钮时，无没有相应的修改。
理想情况：按照初始页面的颜色选择，轮换式修改颜色。

8/ crop页面
裁剪时，若直接点击左上方小程序原生返回按钮，或者进行了右滑操作，则会跳转到证件照制作的空白页面（无任何信息，只有证件照制作的title标识）
最佳实践：用户在裁剪时，若点击了左上角返回按钮，则退回到证件照制作原始页面。

Crop页面中，裁剪白框无法移动或缩放，且下方两行提示文字太过冗余，浓缩成一行。
且仍然无法完成扣背景操作。与此同时，控制台出现与background页面同样的报错。





## 4.10，1732，真机调试：

background页面：无需如此详细的功能说明，只需在最下方有小字，点击之后可以有进一步的具体介绍。无需在初步页面中显示出来。会造成用户的信息过载。
同时注意简洁直白呈现出信息，尤其是无需将API key暴露在外。
抠图背景图片上传时，无需说明原始大小。（即使自己这一端有压缩图片的操作，但用户无需知道）
扣背景失败：Remove调用无效果。无背景同时也无主体。


图像识别页面：进一步完善，同时无需有下方的返回按钮。

证件照制作页面：
选择尺寸的4个按钮，进一步缩小，呈现出2×2的2行2列格式，
将每一选择标准介绍简化，减轻用户负担。分别缩减为“尺寸、背景色、清晰度”。

crop裁剪页面：显示正常。可白框无法移动，无法缩放，只是固定在中间位置。
且在crop页面，点击“取消”时，来到一个空白页面，同时左上角有返回按钮（按钮属于多余）。并没有如期跳转到证件照制作最初页面。

在证件照制作最后的呈现页面：
左上角返回按钮，属多余。
“证件照制作快速制作标准证件照”的描述，属多余。

“更换背景色”按钮，改为“重新生成”。意思为重新跳转到证件照制作初始页面。三标准都可重新选择。

所有页面，返回按钮全删掉。手机操作系统和微信小程序原生按钮足以。（注意，我指的是，原本设计在页面右上角、与小程序原生的“返回”按钮挨近的那个按钮，不是所有的“取消”按钮）

（我说实话，这算是一个刻意练习了。算是自己当一遍用户，把用户旅程图走一遍吧。就算是一个很棒的练习。但说实话，也是一个细致观察的过程，挺喜欢的）

