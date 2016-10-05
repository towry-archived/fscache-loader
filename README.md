# fscache-loader

Use this loader to speed up your webpack build time a bit.

## Install

```bash
npm install fscache-loader --save-dev
```

## Usage

Use this before all your other loaders.

```js
module.exports = {
	// context is required.
	context: __dirname,

	module: {
		loaders: [
			{ test: /\.js$/, exclude: /node_modules/, loaders: ['fscache', 'babel'] },
			// Will not cache less files, only cache the js script for requiring the less files.
			// If you put fscache-loader before less-loader, then it will only 
			// cache the entry less file, and modify the sub module file will not cause
			// the cache invalid.
			{ test: /\.less$/, loaders: ['fscache', 'style', 'css', 'less']},
		]
	},

	fscacheLoader: {
		// Set to false to output some information.
		silent: false
	}
}
```

## LICENSE

MIT License

---

&copy; 2016 Towry Wang
