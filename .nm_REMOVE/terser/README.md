<h1><img src="https://terser.org/img/terser-banner-logo.png" alt="Terser" width="400"></h1>

  [![NPM Version][npm-image]][npm-url]
  [![NPM Downloads][downloads-image]][downloads-url]
  [![CI pipeline][ci-image]][ci-url]
  [![Opencollective financial contributors][opencollective-contributors]][opencollective-url]

A JavaScript mangler/compressor toolkit for ES6+.

*note*: <s>You can support this project on patreon: [link]</s> **The Terser Patreon is shutting down in favor of opencollective**. Check out [PATRONS.md](https://github.com/terser/terser/blob/master/PATRONS.md) for our first-tier patrons.

Terser recommends you use RollupJS to bundle your modules, as that produces smaller code overall.

*Beautification* has been undocumented and is *being removed* from terser, we recommend you use [prettier](https://npmjs.com/package/prettier).

Find the changelog in [CHANGELOG.md](https://github.com/terser/terser/blob/master/CHANGELOG.md)



[npm-image]: https://img.shields.io/npm/v/terser.svg
[npm-url]: https://npmjs.org/package/terser
[downloads-image]: https://img.shields.io/npm/dm/terser.svg
[downloads-url]: https://npmjs.org/package/terser
[ci-image]: https://github.com/terser/terser/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/terser/terser/actions/workflows/ci.yml
[opencollective-contributors]: https://opencollective.com/terser/tiers/badge.svg
[opencollective-url]: https://opencollective.com/terser

Why choose terser?
------------------

`uglify-es` is [no longer maintained](https://github.com/mishoo/UglifyJS2/issues/3156#issuecomment-392943058) and `uglify-js` does not support ES6+.

**`terser`** is a fork of `uglify-es` that mostly retains API and CLI compatibility
with `uglify-es` and `uglify-js@3`.

Install
-------

First make sure you have installed the latest version of [node.js](http://nodejs.org/)
(You may need to restart your computer after this step).

From NPM for use as a command line app:

    npm install terser -g

From NPM for programmatic use:

    npm install terser

# Command line usage

<!-- CLI_USAGE:START -->

```
terser [input files] [options]
```

Terser can take multiple input files.  It's recommended that you pass the
input files first, then pass the options.  Terser will parse input files
in sequence and apply any compression options.  The files are parsed in the
same global scope, that is, a reference from a file to some
variable/function declared in another file will be matched properly.

Command line arguments that take options (like --parse, --compress, --mangle and
--format) can take in a comma-separated list of default option overrides. For
instance:

    terser input.js --compress ecma=2015,computed_props=false

If no input file is specified, Terser will read from STDIN.

If you wish to pass your options before the input files, separate the two with
a double dash to prevent input files being used as option arguments:

    terser --compress --mangle -- input.js

### Command line options

```
    -h, --help                  Print usage information.
                                `--help options` for details on available options.
    -V, --version               Print version number.
    -p, --parse <options>       Specify parser options:
                                `acorn`  Use Acorn for parsing.
                                `bare_returns`  Allow return outside of functions.
                                                Useful when minifying CommonJS
                                                modules and Userscripts that may
                                                be anonymous function wrapped (IIFE)
                                                by the .user.js engine `caller`.
                                `expression`  Parse a single expression, rather than
                                              a program (for parsing JSON).
                                `spidermonkey`  Assume input files are SpiderMonkey
                                                AST format (as JSON).
    -c, --compress [options]    Enable compressor/specify compressor options:
                                `pure_funcs`  List of functions that can be safely
                                              removed when their return values are
                                              not used.
    -m, --mangle [options]      Mangle names/specify mangler options:
                                `reserved`  List of names that should not be mangled.
    --mangle-props [options]    Mangle properties/specify mangler options:
                                `builtins`  Mangle property names that overlaps
                                            with standard JavaScript globals and DOM
                                            API props.
                                `debug`  Add debug prefix and suffix.
                                `keep_quoted`  Only mangle unquoted properties, quoted
                                               properties are automatically reserved.
                                               `strict` disables quoted properties
                                               being automatically reserved.
                                `regex`  Only mangle matched property names.
                                `only_annotated` Only mangle properties defined with /*@__MANGLE_PROP__*/.
                                `reserved`  List of names that should not be mangled.
    -f, --format [options]      Specify format options.
                                `preamble`  Preamble to prepend to the output. You
                                            can use this to insert a comment, for
                                            example for licensing information.
                                            This will not be parsed, but the source
                                            map will adjust for its presence.
                                `quote_style`  Quote style:
                                               0 - auto
                                               1 - single
                                               2 - double
                                               3 - original
                                `wrap_iife`  Wrap IIFEs in parenthesis. Note: you may
                                             want to disable `negate_iife` under
                                             compressor options.
                                `wrap_func_args`  Wrap function arguments in parenthesis.
    -o, --output <file>         Output file path (default STDOUT). Specify `ast` or
                                `spidermonkey` to write Terser or SpiderMonkey AST
                                as JSON to STDOUT respectively.
    --comments [filter]         Preserve copyright comments in the output. By
                                default this works like Google Closure, keeping
                                JSDoc-style comments that contain e.g. "@license",
                                or start with "!". You can optionally pass one of the
                                following arguments to this flag:
                                - "all" to keep all comments
                                - `false` to omit comments in the output
                                - a valid JS RegExp like `/foo/` or `/^!/` to
                                keep only matching comments.
                                Note that currently not *all* comments can be
                                kept when compression is on, because of dead
                                code removal or cascading statements into
                                sequences.
    --config-file <file>        Read `minify()` options from JSON file.
    -d, --define <expr>[=value] Global definitions.
    --ecma <version>            Specify ECMAScript release: 5, 2015, 2016, etc.
    -e, --enclose [arg[:value]] Embed output in a big function with configurable
                                arguments and values.
    --ie8                       Support non-standard Internet Explorer 8.
                                Equivalent to setting `ie8: true` in `minify()`
                                for `compress`, `mangle` and `format` options.
                                By default Terser will not try to be IE-proof.
    --keep-classnames           Do not mangle/drop class names.
    --keep-fnames               Do not mangle/drop function names.  Useful for
                                code relying on Function.prototype.name.
    --module                    Input is an ES6 module. If `compress` or `mangle` is
                                enabled then the `toplevel` option, as well as strict mode,
                                will be enabled.
    --name-cache <file>         File to hold mangled name mappings.
    --safari10                  Support non-standard Safari 10/11.
                                Equivalent to setting `safari10: true` in `minify()`
                                for `mangle` and `format` options.
                                By default `terser` will not work around
                                S