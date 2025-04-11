





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




