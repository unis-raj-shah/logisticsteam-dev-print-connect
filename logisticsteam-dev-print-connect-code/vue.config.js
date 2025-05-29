module.exports = {
    publicPath: '/',
    devServer: {
        host: 'localhost',
        port: "8080",
        proxy: {
            '/shared': {
                // 此处的写法，目的是为了 将 /api 替换成 https://www.baidu.com/
                target: 'https://stage.logisticsteam.com/shared',
                // 允许跨域
                changeOrigin: true,
                ws: true,
                pathRewrite: {
                    '^/shared': ''
                }
            }
        }
    },
    chainWebpack: config => {
        config.plugin('html').tap(args => {
            args[0].title = process.env.VUE_APP_LSO ? 'Local Connect' : (process.env.VUE_APP_ENV == "saas" ? "Item Devices Hub" : "Local Print Connect");
            return args;
        });
    },
    pluginOptions: {
        electronBuilder: {
            nodeIntegration: true,
            // extraResources:["./spool.exe"]

            "builderOptions": {
                "productName": process.env.VUE_APP_PRODUCTNAME,
                "artifactName": process.env.VUE_APP_ENV == "saas" ? "${productName} ${version}.${ext}" : "",
                "extraFiles": [{
                    "from": "./src/assets/printTool/spool.exe",
                    "to": "."
                }, {
                    "from": "./src/assets/printTool/SumatraPDF.exe",
                    "to": "."
                }, {
                    "from": "./src/assets/ssl/local.item.com.key",
                    "to": "."
                }, {
                    "from": "./src/assets/ssl/local.item.com.crt",
                    "to": "."
                }, {
                    "from": "./src/assets/ssl/local.opera8.com.key",
                    "to": "."
                }, {
                    "from": "./src/assets/ssl/local.opera8.com.crt",
                    "to": "."
                }, {
                    "from": "./src/assets/ssl/local.logisticsteam.com.key",
                    "to": "."
                }, {
                    "from": "./src/assets/ssl/local.logisticsteam.com.crt",
                    "to": "."
                }, {
                    "from": "./src/assets/icon/printer.png",
                    "to": "."
                }, {
                    "from": "./src/assets/icon/Devices-Hub-Logo.png",
                    "to": "."
                }],
                "win": {
                    "target": ["nsis", "msi"],        //安装包的格式，默认是"nsis"
                    "icon": process.env.VUE_APP_ENV == "saas" ? "./src/assets/icon/Devices-Hub-Logo.png" : "./src/assets/icon/printer.png"   //安装包的图标
                },
                publish: {
                    provider: 'generic',
                    channel: 'latest',
                    url: process.env.VUE_APP_URL,
                },
                //"target"值"nsis"打包出来的就是exe文件
                //nsis是windows系统安装包的制作程序，它提供了安装、卸载、系统设置等功能
                //关于"nsis"的一些配置
                "nsis": {
                    "oneClick": false,               //是否一键安装，默认为true
                    "language": "2052",              //安装语言，2052对应中文
                    "perMachine": true,              //为当前系统的所有用户安装该应用程序
                    "allowToChangeInstallationDirectory": true   //允许用户选择安装目录
                }


                // extraResources:["./spool.exe"]
            }
        }
    }

}
