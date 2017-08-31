# fscache-loader

Use this loader to speed up your webpack build time a bit.

Make the build _73%_ faster after first build!

Note: you should only use this in production.

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
			{ test: /\.js$/, exclude: /node_modules/, loaders: ['fscache-loader?+silent', 'babel-loader'] },
			// Will not cache less files, only cache the js script for requiring the less files.
			// If you put fscache-loader before less-loader, then it will only
			// cache the entry less file, and modify the sub module file will not cause
			// the cache invalid.
			{ test: /\.less$/, loaders: ['fscache-loader?+silent', 'style-loader', 'css-loader', 'less-loader']},
		]
	}
}
```

## LICENSE

MIT License

---

&copy; 2017 Towry Wang
