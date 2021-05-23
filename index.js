/**
 * @license The MIT License (MIT)
 * @author Stanislav Kalashnik <darkpark.main@gmail.com>
 */

/* eslint no-path-concat: 0 */

'use strict';

var Component = require('spa-component'),
    keys      = require('spa-keys');


/**
 * Mouse click event.
 *
 * @event module:stb/ui/grid~Grid#click:item
 *
 * @type {Object}
 * @property {Element} $item clicked HTML item
 * @property {Event} event click event data
 */


/**
 * Base grid/table implementation.
 *
 * For navigation map implementation and tests see {@link https://gist.github.com/DarkPark/8c0c2926bfa234043ed1}.
 *
 * Each data cell can be either a primitive value or an object with these fields:
 *
 *  Name    | Description
 * ---------|-------------
 *  value   | actual cell value to render
 *  colSpan | amount of cells to merge horizontally
 *  rowSpan | amount of cells to merge vertically
 *  mark    | is it necessary or not to render this cell as marked
 *  focus   | is it necessary or not to render this cell as focused
 *  disable | is it necessary or not to set this cell as disabled
 *
 * @constructor
 * @extends Component
 *
 * @param {Object}   [config={}] init parameters (all inherited from the parent)
 * @param {Array[]}  [config.data=[]] component data to visualize
 * @param {function} [config.render] method to build each grid cell content
 * @param {function} [config.navigate] method to move focus according to pressed keys
 * @param {boolean}  [config.cycleX=true] allow or not to jump to the opposite side of line when there is nowhere to go next
 * @param {boolean}  [config.cycleY=true] allow or not to jump to the opposite side of column when there is nowhere to go next
 * @param {Object}   [config.provider] data provider
 * @param {number}   [config.sizeX] grid columns count
 * @param {number}   [config.sizeX] grid rows count
 *
 * @fires module:stb/ui/grid~Grid#click:item
 *
 * @example
 * var Grid = require('stb/ui/grid'),
 *     grid = new Grid({
 *         data: [
 *             [1,   2,  3, {value: '4;8;12;16', focus: true, rowSpan: 4}],
 *             [5,   6,  7],
 *             [9,  10, 11],
 *             [13, 14, {value: 15, disable: true}]
 *         ],
 *         render: function ( $item, data ) {
 *             $item.innerHTML = '<div>' + (data.value) + '</div>';
 *         },
 *         cycleX: false
 *     });
 */
function Grid ( config ) {
    // current execution context
    //var self = this;

    console.assert(typeof this === 'object', 'must be constructed via new');

    // sanitize
    config = config || {};

    if ( DEVELOP ) {
        if ( typeof config !== 'object' ) {
            throw new Error(__filename + ': wrong config type');
        }
        // init parameters checks
        if ( 'className' in config && (!config.className || typeof config.className !== 'string') ) {
            throw new Error(__filename + ': wrong or empty config.className');
        }
        // if ( config.navigate && typeof config.navigate !== 'function' ) {
        //     throw new Error(__filename + ': wrong config.navigate type');
        // }
    }

    /**
     * List of DOM elements representing the component cells.
     * Necessary for navigation calculations.
     *
     * @type {Element[][]}
     */
    this.map = [];

    /**
     * Link to the currently focused DOM element.
     *
     * @type {Element}
     */
    this.$focusItem = null;

    /**
     * Component data to visualize.
     *
     * @type {Array[]}
     */
    this.data = [];

    /**
     * Allow or not to jump to the opposite side of line when there is nowhere to go next.
     *
     * @type {boolean}
     */
    this.cycleX = true;

    /**
     * Allow or not to jump to the opposite side of column when there is nowhere to go next.
     *
     * @type {boolean}
     */
    this.cycleY = true;

    /**
     * Current navigation map horizontal position.
     *
     * @type {number}
     */
    this.focusX = 0;

    /**
     * Current navigation map vertical position.
     *
     * @type {number}
     */
    this.focusY = 0;

    // set default className if classList property empty or undefined
    //config.className = 'grid ' + (config.className || '');

    // parent constructor call
    Component.call(this, config);

    // component setup
    this.init(config);

    // custom navigation method
    //if ( config.navigate ) {
    //    // apply
    //    this.navigate = config.navigate;
    //}

    // navigation by keyboard
    //this.addListener('keydown', this.navigate);

    // navigation by mouse
    //this.$body.addEventListener('mousewheel', function ( event ) {
    //    // scrolling by Y axis
    //    if ( event.wheelDeltaY ) {
    //        self.move(event.wheelDeltaY > 0 ? keys.up : keys.down);
    //    }
    //
    //    // scrolling by X axis
    //    if ( event.wheelDeltaX ) {
    //        self.move(event.wheelDeltaX > 0 ? keys.left : keys.right);
    //    }
    //});
}


// inheritance
Grid.prototype = Object.create(Component.prototype);
Grid.prototype.constructor = Grid;

// set component name
Grid.prototype.name = 'spa-component-grid';


/**
 * Fill the given cell with data.
 * $item.data can contain the old data (from the previous render).
 *
 * @param {Element} $item item DOM link
 * @param {*} data associated with this item data
 */
Grid.prototype.renderItemDefault = function ( $item, data ) {
    if ( DEVELOP ) {
        if ( arguments.length !== 2 ) {
            throw new Error(__filename + ': wrong arguments number');
        }
        if ( !($item instanceof Element) ) {
            throw new Error(__filename + ': wrong $item type');
        }
    }

    $item.innerText = data.value;
};


/**
 * Method to build each grid cell content.
 * Can be redefined to provide custom rendering.
 *
 * @type {function}
 */
Grid.prototype.renderItem = Grid.prototype.renderItemDefault;


/**
 * List of all default event callbacks.
 *
 * @type {Object.<string, function>}
 */
Grid.prototype.defaultEvents = {
    /**
     * Default method to handle mouse wheel events.
     *
     * @param {Event} event generated event
     */
    mousewheel: function ( event ) {
        // scrolling by Y axis
        if ( event.wheelDeltaY ) {
            this.move(event.wheelDeltaY > 0 ? keys.up : keys.down);
        }

        // scrolling by X axis
        if ( event.wheelDeltaX ) {
            this.move(event.wheelDeltaX > 0 ? keys.left : keys.right);
        }
    },

    /**
     * Default method to handle keyboard keydown events.
     *
     * @param {Object} event generated event
     */
    keydown: function ( event ) {
        switch ( event.code ) {
            case keys.up:
            case keys.down:
            case keys.right:
            case keys.left:
                // cursor move only on arrow keys
                this.move(event.code);
                break;
            case keys.enter:
                // there are some listeners
                if ( this.events['click:item'] ) {
                    // notify listeners
                    this.emit('click:item', {$item: this.$focusItem, event: event});
                }
                break;
        }
    }
};


/**
 * Default method to move focus according to pressed keys.
 *
 * @param {Object} event generated event source of movement
 */
//Grid.prototype.navigateDefault = function ( event ) {
//    switch ( event.code ) {
//        case keys.up:
//        case keys.down:
//        case keys.right:
//        case keys.left:
//            // cursor move only on arrow keys
//            this.move(event.code);
//            break;
//        case keys.ok:
//            // there are some listeners
//            if ( this.events['click:item'] ) {
//                // notify listeners
//                this.emit('click:item', {$item: this.$focusItem, event: event});
//            }
//            break;
//    }
//};


/**
 * Current active method to move focus according to pressed keys.
 * Can be redefined to provide custom navigation.
 *
 * @type {function}
 */
//Grid.prototype.navigate = Grid.prototype.navigateDefault;


/**
 * Make all the data items identical.
 * Wrap to objects if necessary and add missing properties.
 *
 * @param {Array[]} data user 2-dimensional array
 * @return {Array[]} reworked incoming data
 */
function normalize ( data ) {
    var idxY, idxX, item;

    if ( DEVELOP ) {
        if ( arguments.length !== 1 ) {
            throw new Error(__filename + ': wrong arguments number');
        }
        if ( !Array.isArray(data) ) {
            throw new Error(__filename + ': wrong data type');
        }
    }

    // rows
    for ( idxY = 0; idxY < data.length; idxY++ ) {
        // cols
        for ( idxX = 0; idxX < data[idxY].length; idxX++ ) {
            // cell value
            item = data[idxY][idxX];

            // primitive value
            if ( typeof item === 'object' ) {
                // always at least one row/col
                item.colSpan = item.colSpan || 1;
                item.rowSpan = item.rowSpan || 1;
            } else {
                // wrap with defaults
                item = data[idxY][idxX] = {
                    value: data[idxY][idxX],
                    colSpan: 1,
                    rowSpan: 1
                };
            }

            if ( DEVELOP ) {
                // if ( !('value' in item) ) {
                //     throw new Error(__filename + ': field "value" is missing');
                // }
                if ( Number(item.colSpan) !== item.colSpan ) {
                    throw new Error(__filename + ': item.colSpan must be a number');
                }
                if ( Number(item.rowSpan) !== item.rowSpan ) {
                    throw new Error(__filename + ': item.rowSpan must be a number');
                }
                if ( item.colSpan <= 0 ) {
                    throw new Error(__filename + ': item.colSpan should be positive');
                }
                if ( item.rowSpan <= 0 ) {
                    throw new Error(__filename + ': item.rowSpan should be positive');
                }
                if ( ('focus' in item) && Boolean(item.focus) !== item.focus ) {
                    throw new Error(__filename + ': item.focus must be boolean');
                }
                if ( ('disable' in item) && Boolean(item.disable) !== item.disable ) {
                    throw new Error(__filename + ': item.disable must be boolean');
                }
            }
        }
    }

    return data;
}


/**
 * Fill the given rectangle area with value.
 *
 * @param {Array[]} map link to navigation map
 * @param {number} posX current horizontal position
 * @param {number} posY current vertical position
 * @param {number} dX amount of horizontal cell to fill
 * @param {number} dY amount of vertical cell to fill
 * @param {*} value filling data
 */
function fill ( map, posX, posY, dX, dY, value ) {
    var idxY, idxX;

    if ( DEVELOP ) {
        if ( arguments.length !== 6 ) {
            throw new Error(__filename + ': wrong arguments number');
        }
        if ( !Array.isArray(map) ) {
            throw new Error(__filename + ': wrong map type');
        }
    }

    // rows
    for ( idxY = posY; idxY < posY + dY; idxY++ ) {
        // expand map rows
        if ( map.length < idxY + 1 ) { map.push([]); }

        // compensate long columns from previous rows
        while ( map[idxY][posX] !== undefined ) {
            posX++;
        }

        // cols
        for ( idxX = posX; idxX < posX + dX; idxX++ ) {
            // expand map row cols
            if ( map[idxY].length < idxX + 1 ) { map[idxY].push(); }
            // fill
            map[idxY][idxX] = value;
            // apply coordinates for future mouse clicks
            if ( value.x === undefined ) { value.x = idxX; }
            if ( value.y === undefined ) { value.y = idxY; }
        }
    }
}


/**
 * Create a navigation map from incoming data.
 *
 * @param {Array[]} data user 2-dimensional array of objects
 * @return {Array[]} navigation map
 */
function map ( data ) {
    var result = [],
        idxY, idxX, item;

    if ( DEVELOP ) {
        if ( arguments.length !== 1 ) {
            throw new Error(__filename + ': wrong arguments number');
        }
        if ( !Array.isArray(data) ) {
            throw new Error(__filename + ': wrong data type');
        }
    }

    // rows
    for ( idxY = 0; idxY < data.length; idxY++ ) {
        // cols
        for ( idxX = 0; idxX < data[idxY].length; idxX++ ) {
            // cell value
            item = data[idxY][idxX];
            // process a cell
            fill(result, idxX, idxY, item.colSpan, item.rowSpan, item.$item);
            // clear redundant info
            delete item.$item;
        }
    }

    return result;
}


/**
 * Init or re-init of the component inner structures and HTML.
 *
 * @param {Object} config init parameters (subset of constructor config params)
 */
Grid.prototype.init = function ( config ) {
    var self = this,
        draw = false,
        idxY, idxX,
        $row, $item, $tbody, $focusItem,
        itemData, newData,
        /**
         * Cell mouse click handler.
         *
         * @param {Event} event click event data
         *
         * @this Element
         *
         * @fires module:stb/ui/grid~Grid#click:item
         */
        onItemClick = function ( event ) {
            // allow to accept focus
            if ( this.data.disable !== true ) {
                // visualize
                self.focusItem(this);

                // there are some listeners
                if ( self.events['click:item'] ) {
                    // notify listeners
                    self.emit('click:item', {$item: this, event: event});
                }
            }
        },
        /**
         * Cell mouse hover handler.
         *
         * @this Element
         */
        onItemHover = function () {
            if ( this.data.disable !== true ) {
                self.focusItem(this);
            }
        },
        /**
         * Construct grid when receive new data
         *
         * @param {Array} data to render
         */
        construct = function ( data ) {

            // apply data
            if ( data ) {
                // new data is different
                if ( self.data !== data ) {
                    // apply
                    self.data = data;
                    // need to redraw table
                    draw = true;
                }
            }

            // custom render method
            if ( config.render ) {
                // new render is different
                if ( self.renderItem !== config.render ) {
                    // apply
                    self.renderItem = config.render;
                    // need to redraw table
                    draw = true;
                }
            }

            if ( !draw ) {
                // do not redraw table
                return;
            }

            // export pointer to inner table
            self.$table = document.createElement('table');
            $tbody = document.createElement('tbody');

            // prepare user data
            self.data = normalize(self.data);

            // rows
            for ( idxY = 0; idxY < self.data.length; idxY++ ) {
                // dom
                $row = $tbody.insertRow();

                // cols
                for ( idxX = 0; idxX < self.data[idxY].length; idxX++ ) {
                    // dom
                    $item = $row.insertCell(-1);
                    // additional params
                    $item.className = 'item';

                    // shortcut
                    itemData = self.data[idxY][idxX];

                    // for map
                    itemData.$item = $item;

                    // merge columns
                    $item.colSpan = itemData.colSpan;

                    // merge rows
                    $item.rowSpan = itemData.rowSpan;

                    // active cell
                    if ( itemData.focus ) {
                        // store and clean
                        $focusItem = $item;
                    }

                    // disabled cell
                    if ( itemData.disable ) {
                        // apply CSS
                        $item.classList.add('disable');
                    }

                    // marked cell
                    if ( itemData.mark ) {
                        // apply CSS
                        $item.classList.add('mark');
                    }

                    // visualize
                    self.renderItem($item, itemData);

                    // save data link
                    $item.data = itemData;

                    // manual focusing
                    $item.addEventListener('click', onItemClick);

                    if ( self.hoverable ) {
                        $item.addEventListener('mouseover', onItemHover);
                    }
                }
                // row is ready
                $tbody.appendChild($row);
            }

            // navigation map filling
            self.map = map(self.data);

            // clear all table
            self.$body.innerText = null;

            // everything is ready
            self.$table.appendChild($tbody);
            self.$body.appendChild(self.$table);

            // apply focus
            if ( $focusItem ) {
                // focus item was given in data
                self.focusItem($focusItem);
            } else {
                // just the first cell
                self.focusItem(self.map[0][0]);
            }
        };

    if ( DEVELOP ) {
        if ( arguments.length !== 1 ) {
            throw new Error(__filename + ': wrong arguments number');
        }
        if ( typeof config !== 'object' ) {
            throw new Error(__filename + ': wrong config type');
        }
        if ( config.data && (!Array.isArray(config.data) || !Array.isArray(config.data[0])) ) {
            throw new Error(__filename + ': wrong config.data type');
        }
        if ( config.render && typeof config.render !== 'function' ) {
            throw new Error(__filename + ': wrong config.render type');
        }
    }

    // apply cycle behaviour
    if ( config.cycleX !== undefined ) {
        this.cycleX = config.cycleX;
    }
    if ( config.cycleY !== undefined ) {
        this.cycleY = config.cycleY;
    }


    if ( config.provider ) {
        if ( DEVELOP ) {
            if ( !config.sizeX || !config.sizeY ) {
                throw new Error(__filename + ': wrong grid data size');
            }
        }

        this.provider = config.provider;
        this.sizeX = config.sizeX;
        this.sizeY = config.sizeY;
    }

    if ( config.translate ) {
        this.translate = config.translate;
    }

    if ( config.provider ) {
        newData = this.provider.get(null, function ( error, data ) {
            if ( error ) {
                if ( self.events['data:error'] ) {
                    /**
                     * Provider get error while take new data
                     *
                     * @event module:stb/ui/grid~Grid#data:error
                     */
                    self.emit('data:error', error);
                }
            }
            construct(self.translate(data));

            if ( self.events['data:ready'] ) {
                /**
                 * Provider get new data and reinit grid
                 *
                 * @event module:stb/ui/grid~Grid#data:ready
                 */
                self.emit('data:ready');
            }
        });

        if ( this.events['data:get'] ) {
            /**
             * Provider request new data
             *
             * @event module:stb/ui/grid~Grid#data:get
             *
             * @type {Object}
             * @property {boolean} fresh status of data to response
             */
            this.emit('data:get', {fresh: newData});
        }
    } else {
        construct(config.data);
    }


};

/**
 * Default translate function
 *
 * @param {Array} data to translate
 * @return {Array} data to use as grid data
 */
Grid.prototype.defaultTranslate = function ( data ) {
    var result = [],
        idxY, idxX, arr;

    for ( idxY = 0; idxY < this.sizeY; idxY++ ) {
        arr = [];
        for ( idxX = 0; idxX < this.sizeX; idxX++ ) {
            arr[idxX] = data[idxY * this.sizeX + idxX];
        }
        result[idxY] = arr;
    }

    return result;
};


/**
 * Method to translate given array to array adapted to use as grid data
 * Can be redefined to provide custom translate.
 *
 * @type {function}
 */
Grid.prototype.translate = Grid.prototype.defaultTranslate;


/**
 * Move focus to the given direction.
 *
 * @param {number} direction arrow key code
 *
 * @fires module:stb/ui/grid~Grid#cycle
 * @fires module:stb/ui/grid~Grid#overflow
 * @fires module:stb/ui/grid~Grid#data:get
 * @fires module:stb/ui/grid~Grid#data:ready
 * @fires module:stb/ui/grid~Grid#data:error
 */
Grid.prototype.move = function ( direction ) {
    var focusX   = this.focusX,
        focusY   = this.focusY,
        move     = true,
        overflow = false,
        cycle    = false,
        newData;

    if ( DEVELOP ) {
        if ( arguments.length !== 1 ) {
            throw new Error(__filename + ': wrong arguments number');
        }
        if ( Number(direction) !== direction ) {
            throw new Error(__filename + ': direction must be a number');
        }
    }

    // shift till full stop
    while ( move ) {
        // arrow keys
        switch ( direction ) {
            case keys.up:
                if ( focusY > 0 ) {
                    // can go one step up
                    focusY--;
                } else {
                    if ( this.cycleY ) {
                        // jump to the last row
                        focusY = this.map.length - 1;
                        cycle = true;
                    }
                    // grid edge
                    overflow = true;
                }
                break;

            case keys.down:
                if ( focusY < this.map.length - 1 ) {
                    // can go one step down
                    focusY++;
                } else {
                    if ( this.cycleY ) {
                        // jump to the first row
                        focusY = 0;
                        cycle = true;
                    }
                    // grid edge
                    overflow = true;
                }
                break;

            case keys.right:
                if ( focusX < this.map[focusY].length - 1 ) {
                    // can go one step right
                    focusX++;
                } else {
                    if ( this.cycleX ) {
                        // jump to the first column
                        focusX = 0;
                        cycle = true;
                    }
                    // grid edge
                    overflow = true;
                }
                break;

            case keys.left:
                if ( focusX > 0 ) {
                    // can go one step left
                    focusX--;
                } else {
                    if ( this.cycleX ) {
                        // jump to the last column
                        focusX = this.map[focusY].length - 1;
                        cycle = true;
                    }
                    // grid edge
                    overflow = true;

                }
                break;
        }

        // full cycle - has come to the start point
        if ( focusX === this.focusX && focusY === this.focusY ) {
            // full stop
            move = false;
        }

        // focus item has changed and it's not disabled
        if ( this.map[focusY][focusX] !== this.map[this.focusY][this.focusX] && this.map[focusY][focusX].data.disable !== true ) {
            // full stop
            move = false;
        }

        // the last cell in a row/col
        if ( overflow ) {
            // full stop
            move = false;
            // but it's disabled so need to go back
            if ( this.map[focusY][focusX].data.disable === true ) {
                // return to the start point
                focusX = this.focusX;
                focusY = this.focusY;
            }
        }
    }

    this.focusItem(this.map[focusY][focusX]);

    // correct coordinates
    // focusItem set approximate values
    this.focusX = focusX;
    this.focusY = focusY;

    if ( overflow ) {
        //
        if ( this.provider ) {
            newData = this.provider.get(direction, function ( error, data ) {
                var  idxY, idxX;

                if ( error ) {

                    if ( self.events['data:error'] ) {
                        /**
                         * Provider get error while take new data
                         *
                         * @event module:stb/ui/grid~Grid#data:error
                         */
                        self.emit('data:error', error);

                        return;
                    }
                }

                if ( data ) {
                    self.data = self.translate(data);
                    for ( idxY = 0; idxY < self.sizeY - 1; idxY++ ) {
                        for ( idxX = 0; idxX < self.sizeX; idxX++ ) {
                            self.renderItem(self.map[idxY][idxX], self.data[idxY][idxX]);
                        }
                    }

                    if ( self.events['data:ready'] ) {
                        /**
                         * Provider get new data and reinit grid
                         *
                         * @event module:stb/ui/grid~Grid#data:ready
                         */
                        self.emit('data:ready');
                    }
                }

            });

            if ( this.events['data:get'] ) {
                /**
                 * Provider request new data
                 *
                 * @event module:stb/ui/grid~Grid#data:get
                 *
                 * @type {Object}
                 * @property {boolean} fresh status of data to response
                 */
                this.emit('data:get', {fresh: newData});
            }
        }

        // there are some listeners
        if ( this.events['overflow'] ) {
            /**
             * Attempt to go beyond the edge of the grid.
             *
             * @event module:stb/ui/grid~Grid#overflow
             *
             * @type {Object}
             * @property {number} direction key code initiator of movement
             * @property {number} cycle ...
             */
            this.emit('overflow', {direction: direction, cycle: cycle});
        }
    }

    // report
    debug.info(this.focusX + ' : ' + focusX, 'X old/new');
    debug.info(this.focusY + ' : ' + focusY, 'Y old/new');
    debug.info(cycle, 'cycle');
    debug.info(overflow, 'overflow');


};


/**
 * Highlight the given DOM element as focused.
 * Remove focus from the previously focused item.
 *
 * @param {Node|Element} $item element to focus
 * @param {number} $item.x the item horizontal position
 * @param {number} $item.y the item vertical position
 *
 * @return {boolean} operation status
 *
 * @fires module:stb/ui/grid~Grid#focus:item
 * @fires module:stb/ui/grid~Grid#blur:item
 */
Grid.prototype.focusItem = function ( $item ) {
    var $prev = this.$focusItem;

    if ( DEVELOP ) {
        if ( arguments.length !== 1 ) {
            throw new Error(__filename + ': wrong arguments number');
        }
    }

    // different element
    if ( $item && $prev !== $item && $item.data.disable !== true ) {
        if ( DEVELOP ) {
            if ( !($item instanceof Element) ) {
                throw new Error(__filename + ': wrong $item type');
            }
            if ( $item.parentNode.parentNode.parentNode.parentNode !== this.$body ) {
                throw new Error(__filename + ': wrong $item parent element');
            }
        }

        // some item is focused already
        if ( $prev !== null ) {
            if ( DEVELOP ) {
                if ( !($prev instanceof Element) ) {
                    throw new Error(__filename + ': wrong $prev type');
                }
            }

            // style
            $prev.classList.remove('focus');

            // there are some listeners
            if ( this.events['blur:item'] ) {
                /**
                 * Remove focus from an element.
                 *
                 * @event module:stb/ui/grid~Grid#blur:item
                 *
                 * @type {Object}
                 * @property {Element} $item previously focused HTML element
                 */
                this.emit('blur:item', {$item: $prev});
            }
        }

        // draft coordinates
        this.focusX = $item.x;
        this.focusY = $item.y;

        // reassign
        this.$focusItem = $item;

        // correct CSS
        $item.classList.add('focus');

        // there are some listeners
        if ( this.events['focus:item'] ) {
            /**
             * Set focus to an element.
             *
             * @event module:stb/ui/grid~Grid#focus:item
             *
             * @type {Object}
             * @property {Element} $prev old/previous focused HTML element
             * @property {Element} $curr new/current focused HTML element
             */
            this.emit('focus:item', {$prev: $prev, $curr: $item});
        }

        return true;
    }

    // nothing was done
    return false;
};


/**
 * Set item state and appearance as marked.
 *
 * @param {Node|Element} $item element to focus
 * @param {boolean} state true - marked, false - not marked
 */
Grid.prototype.markItem = function ( $item, state ) {
    if ( DEVELOP ) {
        if ( arguments.length !== 2 ) {
            throw new Error(__filename + ': wrong arguments number');
        }
        if ( !($item instanceof Element) ) {
            throw new Error(__filename + ': wrong $item type');
        }
        if ( $item.parentNode.parentNode.parentNode.parentNode !== this.$body ) {
            throw new Error(__filename + ': wrong $item parent element');
        }
        if ( Boolean(state) !== state ) {
            throw new Error(__filename + ': state must be boolean');
        }
    }

    // correct CSS
    if ( state ) {
        $item.classList.add('mark');
    } else {
        $item.classList.remove('mark');
    }

    // apply flag
    $item.data.mark = state;
};


// public
module.exports = Grid;
