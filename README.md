electron-vue-ts
Node 版本 16.20.2
Project setup
npm install
Compiles and hot-reloads for development
npm run electron:serve
Compiles and minifies for production
npm run electron:buildSaas
npm run electron:buildUnis
发布代码前需要的步骤
1.需要在package.json的version属性自增0.0.1, 比如之前是1.0.0, 需要改成1.0.1
2.需要在Debug.vue文件更改版本号， 在showLog函数的旁边， 跟package.json的version保持同步
Customize configuration
See Configuration Reference.
