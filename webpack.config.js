var path=require('path')
module.exports={
    entry:path.resolve(__dirname, './src/flv2fmp4.js'),
    output: {
        path: path.resolve(__dirname, './lib'),
        filename: 'index.js',
        library: "chimee-flv2fmp4",
        libraryTarget: "commonjs2",
    },
    
     module: {
        loaders: [

            /*
             * 你可以在这配置别的加载器，写法是一样的
             * */
            // {
            //     test: /\.(jsx|js)$/,
            //     loader: 'babel-loader',
            //     exclude: /node_modules/,
            //     query: {
            //         presets: ['es2015', 'react']
            //     }
            // },
            { test: /\.js?$/, loaders: ['babel-loader'] ,exclude: /node_modules/, }, 
        ]
     }
}   