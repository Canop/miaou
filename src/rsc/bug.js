// ==ClosureCompiler==
// @compilation_level SIMPLE_OPTIMIZATIONS
// @output_file_name bug-min.js
// ==/ClosureCompiler==
/**
 * @preserve Bug.js - https://github.com/Auz/Bug
 * Released under MIT-style license.
 * Original Screen Bug http://screen-bug.googlecode.com/git/index.html
 */
/**
 * Bug.js - Add bugs to your page
 *
 * https://github.com/Auz/Bug
 *
 * license: MIT-style license.
 * copyright: Copyright (c) 2013 Graham McNicoll
 *
 *
 * Created for an aprils fool joke at Education.com 2013. I knew there was probably a script
 * that did it already, and there was: http://screen-bug.googlecode.com/git/index.html.
 * I used this as the starting point and heavily modified it, used sprite image animation,
 * and added many new features.
 *
 *
 * Original Screen Bug http://screen-bug.googlecode.com/git/index.html
 * Copyright ©2011 Kernc (kerncece ^_^ gmail)
 * Released under WTFPL license.
 *
 */
"use strict";


var BugDispatch = {

    options: {
        minDelay: 500,
        maxDelay: 10000,
        minBugs: 2,
        maxBugs: 20,
        minSpeed: 5,
        maxSpeed: 10,
        maxLargeTurnDeg: 150,
        maxSmallTurnDeg: 10,
        maxWiggleDeg: 5,
        imageSprite: 'static/fly-sprite.png',
        bugWidth: 13,
        bugHeight: 14,
        num_frames: 5,
        zoom: 10, // random zoom variation from 1 to 10 - 10 being full size.
        canFly: true,
        canDie: true,
        numDeathTypes: 3,
        monitorMouseMovement: false,
        eventDistanceToBug: 40,
        minTimeBetweenMultipy: 1000,
        mouseOver: 'random' // can be 'fly', 'flyoff' (if the bug can fly), die', 'multiply', 'nothing' or 'random'
    },

    initialize: function(options) {

        this.options = mergeOptions(this.options, options);

        // sanity check:
        if (this.options.minBugs > this.options.maxBugs) {
            this.options.minBugs = this.options.maxBugs;
        }

        this.modes = ['multiply', 'nothing'];

        if (this.options.canFly) {
            this.modes.push('fly', 'flyoff');
        }
        if (this.options.canDie) {
            this.modes.push('die');
        }

        if (this.modes.indexOf(this.options.mouseOver) == -1) {
            // invalid mode: use random:
            this.options.mouseOver = 'random';
        }

        // can we transform?
        this.transform = null;

        this.transforms = {
            'Moz': function(s) {
                this.bug.style.MozTransform = s;
            },
            'webkit': function(s) {
                this.bug.style.webkitTransform = s;
            },
            'O': function(s) {
                this.bug.style.OTransform = s;
            },
            'ms': function(s) {
                this.bug.style.msTransform = s;
            },
            'Khtml': function(s) {
                this.bug.style.KhtmlTransform = s;
            },
            'w3c': function(s) {
                this.bug.style.transform = s;
            }
        };


        // check to see if it is a modern browser:

        if ('transform' in document.documentElement.style) {
            this.transform = this.transforms.w3c;
        } else {

            // feature detection for the other transforms:
            var vendors = ['Moz', 'webkit', 'O', 'ms', 'Khtml'],
                i = 0;

            for (i = 0; i < vendors.length; i++) {
                if (vendors[i] + 'Transform' in document.documentElement.style) {
                    this.transform = this.transforms[vendors[i]];
                    break;
                }
            }
        }

        // dont support transforms... quit
        if (!this.transform) return;

        // make bugs:
        this.bugs = [];
        var numBugs = (this.options.mouseOver === 'multiply') ? this.options.minBugs : this.random(this.options.minBugs, this.options.maxBugs, true),
            i = 0,
            that = this;

        for (i = 0; i < numBugs; i++) {
            var options = JSON.parse(JSON.stringify(this.options)),
                b = SpawnBug();

            options.wingsOpen = (this.options.canFly) ? ((Math.random() > 0.5) ? true : false) : true,
                options.walkSpeed = this.random(this.options.minSpeed, this.options.maxSpeed),

                b.initialize(this.transform, options);
            this.bugs.push(b);
        }

        // fly them in staggered:
        for (i = 0; i < numBugs; i++) {
            var delay = this.random(this.options.minDelay, this.options.maxDelay, true),
                thebug = this.bugs[i];
            // fly the bug onto the page:
            setTimeout((function(thebug) {
                return function() {
                    if (that.options.canFly) {
                        thebug.flyIn();
                    } else {
                        thebug.walkIn();
                    }

                };
            }(thebug)), delay);

            // add mouse over events:
            that.add_events_to_bug(thebug);
        }

        // add window event if required:
        if (this.options.monitorMouseMovement) {
            window.onmousemove = function() {
                that.check_if_mouse_close_to_bug();
            };
        }

    },

    stop: function() {
        for (var i = 0; i < this.bugs.length; i++) {
            this.bugs[i].stop();
        }
    },

    end: function() {
        for (var i = 0; i < this.bugs.length; i++) {
            this.bugs[i].stop();
            this.bugs[i].remove();
        }
    },

    reset: function() {
        this.stop();
        for (var i = 0; i < this.bugs.length; i++) {
            this.bugs[i].reset();
            this.bugs[i].walkIn();
        }
    },

    killAll: function() {
        for (var i = 0; i < this.bugs.length; i++) {
            this.bugs[i].die();
        }
    },

    add_events_to_bug: function(thebug) {
        var that = this;
        if (thebug.bug) {
            if (thebug.bug.addEventListener) {
                thebug.bug.addEventListener('mouseover', function(e) {
                    that.on_bug(thebug);
                });
            } else if (thebug.bug.attachEvent) {
                thebug.bug.attachEvent('onmouseover', function(e) {
                    that.on_bug(thebug);
                });
            }
        }
    },

    check_if_mouse_close_to_bug: function(e) {
        e = e || window.event;
        if (!e) {
            return;
        }

        var posx = 0,
            posy = 0;
        if (e.client && e.client.x) {
            posx = e.client.x;
            posy = e.client.y;
        } else if (e.clientX) {
            posx = e.clientX;
            posy = e.clientY;
        } else if (e.page && e.page.x) {
            posx = e.page.x - (document.body.scrollLeft + document.documentElement.scrollLeft);
            posy = e.page.y - (document.body.scrollTop + document.documentElement.scrollTop);
        } else if (e.pageX) {
            posx = e.pageX - (document.body.scrollLeft + document.documentElement.scrollLeft);
            posy = e.pageY - (document.body.scrollTop + document.documentElement.scrollTop);
        }
        var numBugs = this.bugs.length,
            i = 0;
        for (i = 0; i < numBugs; i++) {
            var pos = this.bugs[i].getPos();
            if (pos) {
                if (Math.abs(pos.top - posy) + Math.abs(pos.left - posx) < this.options.eventDistanceToBug && !this.bugs[i].flyperiodical) {
                    this.near_bug(this.bugs[i]);
                }
            }
        }

    },

    near_bug: function(bug) {
        this.on_bug(bug);
    },

    on_bug: function(bug) {
        if (!bug.alive) {
            return;
        }

        var mode = this.options.mouseOver;

        if (mode === 'random') {
            mode = this.modes[(this.random(0, (this.modes.length - 1), true))];
        }

        if (mode === 'fly') {
            // fly away!
            bug.stop();
            bug.flyRand();
        } else if (mode === 'nothing') {
            return;
        } else if (mode === 'flyoff') {
            // fly away and off the page
            bug.stop();
            bug.flyOff();
        } else if (mode === 'die') {
            // drop dead!
            bug.die();
        } else if (mode === 'multiply') {
            if (!this.multiplyDelay && this.bugs.length < this.options.maxBugs) {
                // spawn another: 
                // create new bug:
                var b = SpawnBug(),
                    options = JSON.parse(JSON.stringify(this.options)),
                    pos = bug.getPos(),
                    that = this;

                options.wingsOpen = (this.options.canFly) ? ((Math.random() > 0.5) ? true : false) : true;
                options.walkSpeed = this.random(this.options.minSpeed, this.options.maxSpeed);

                b.initialize(this.transform, options);
                b.drawBug(pos.top, pos.left);
                // fly them both away:
                if (options.canFly) {
                    b.flyRand();
                    bug.flyRand();
                } else {
                    b.go();
                    bug.go();
                }
                // store new bug:
                this.bugs.push(b);
                // watch out for spawning too quickly:
                this.multiplyDelay = true;
                setTimeout(function() {
                    // add event to this bug:
                    that.add_events_to_bug(b);
                    that.multiplyDelay = false;
                }, this.options.minTimeBetweenMultipy);
            }

        }
    },

    random: function(min, max, round) {
        if (min == max) return ((round) ? Math.round(min) : min);

        var result = ((min - 0.5) + (Math.random() * (max - min + 1)));
        if (result > max) {
            result = max;
        } else if (result < min) {
            result = min;
        }
        return ((round) ? Math.round(result) : result);
    }


};

var BugController = function() {
    this.initialize.apply(this, arguments);
}
BugController.prototype = BugDispatch;

var SpiderController = function() {
    var spiderOptions = {
        imageSprite: 'static/spider-sprite.png',
        bugWidth: 69,
        bugHeight: 90,
        num_frames: 7,
        canFly: false,
        canDie: true,
        numDeathTypes: 2,
        zoom: 6,
        minDelay: 200,
        maxDelay: 3000,
        minSpeed: 6,
        maxSpeed: 13,
        minBugs: 3,
        maxBugs: 10
    };
    this.options = mergeOptions(this.options, spiderOptions);
    this.initialize.apply(this, arguments);

}
SpiderController.prototype = BugDispatch;

/***************/
/**    Bug    **/
/***************/

var Bug = {

    options: {
        wingsOpen: false,
        walkSpeed: 2,
        flySpeed: 40,
        edge_resistance: 50,
        zoom: 10

    },

    initialize: function(transform, options) {

        this.options = mergeOptions(this.options, options);

        this.NEAR_TOP_EDGE = 1;
        this.NEAR_BOTTOM_EDGE = 2;
        this.NEAR_LEFT_EDGE = 4;
        this.NEAR_RIGHT_EDGE = 8;
        this.directions = {}; // 0 degrees starts on the East
        this.directions[this.NEAR_TOP_EDGE] = 270;
        this.directions[this.NEAR_BOTTOM_EDGE] = 90;
        this.directions[this.NEAR_LEFT_EDGE] = 0;
        this.directions[this.NEAR_RIGHT_EDGE] = 180;
        this.directions[this.NEAR_TOP_EDGE + this.NEAR_LEFT_EDGE] = 315;
        this.directions[this.NEAR_TOP_EDGE + this.NEAR_RIGHT_EDGE] = 225;
        this.directions[this.NEAR_BOTTOM_EDGE + this.NEAR_LEFT_EDGE] = 45;
        this.directions[this.NEAR_BOTTOM_EDGE + this.NEAR_RIGHT_EDGE] = 135;

        this.angle_deg = 0;
        this.angle_rad = 0;
        this.large_turn_angle_deg = 0;
        this.near_edge = false;
        this.edge_test_counter = 10;
        this.small_turn_counter = 0;
        this.large_turn_counter = 0;
        this.fly_counter = 0;
        this.toggle_stationary_counter = Math.random() * 50;
        this.zoom = this.random(this.options.zoom, 10) / 10;

        this.stationary = false;
        this.bug = null;
        this.wingsOpen = this.options.wingsOpen;
        this.transform = transform;
        this.walkIndex = 0;
        this.flyIndex = 0;
        this.alive = true;
        this.twitchTimer = null;

        this.rad2deg_k = 180 / Math.PI;
        this.deg2rad_k = Math.PI / 180;

        this.makeBug();

        this.angle_rad = this.deg2rad(this.angle_deg);

        this.angle_deg = this.random(0, 360, true);

    },

    go: function() {
        if (this.transform) {
            this.drawBug();
            var that = this;

            this.animating = true;

            this.going = requestAnimFrame(function(t) {
                that.animate(t);
            });
        }
    },

    stop: function() {
        this.animating = false;
        if (this.going) {
            clearTimeout(this.going);
            this.going = null;
        }
        if (this.flyperiodical) {
            clearTimeout(this.flyperiodical);
            this.flyperiodical = null;
        }
        if (this.twitchTimer) {
            clearTimeout(this.twitchTimer);
            this.twitchTimer = null;
        }
    },

    remove: function() {
        if (this.inserted && this.bug.parentNode) {
            this.bug.parentNode.removeChild(this.bug);
            this.inserted = false;
        }
    },

    reset: function() {
        this.alive = true;
        this.bug.style.bottom = '';
        this.bug.style.top = 0;
        this.bug.style.left = 0;
    },

    animate: function(t) {

        if (!this.animating || !this.alive) return;

        var that = this;
        this.going = requestAnimFrame(function(t) {
            that.animate(t);
        });

        if (!('_lastTimestamp' in this)) this._lastTimestamp = t;

        var delta = t - this._lastTimestamp;

        if (delta < 40) return; // don't animate too frequently

        // sometimes if the browser doesnt have focus, or the delta in request animation 
        // frame can be very large. We set a sensible max so that the bugs dont spaz out.

        if (delta > 200) delta = 200;

        this._lastTimestamp = t;

        if (--this.toggle_stationary_counter <= 0) {
            this.toggleStationary();
        }
        if (this.stationary) {
            return;
        }


        if (--this.edge_test_counter <= 0 && this.bug_near_window_edge()) {
            // if near edge, go away from edge
            this.angle_deg %= 360;
            if (this.angle_deg < 0) this.angle_deg += 360;

            if (Math.abs(this.directions[this.near_edge] - this.angle_deg) > 15) {
                var angle1 = this.directions[this.near_edge] - this.angle_deg;
                var angle2 = (360 - this.angle_deg) + this.directions[this.near_edge];
                this.large_turn_angle_deg = (Math.abs(angle1) < Math.abs(angle2) ? angle1 : angle2);

                this.edge_test_counter = 10;
                this.large_turn_counter = 100;
                this.small_turn_counter = 30;
            }
        }
        if (--this.large_turn_counter <= 0) {
            this.large_turn_angle_deg = this.random(1, this.options.maxLargeTurnDeg, true);
            this.next_large_turn();
        }
        if (--this.small_turn_counter <= 0) {
            this.angle_deg += this.random(1, this.options.maxSmallTurnDeg);
            this.next_small_turn();
        } else {
            var dangle = this.random(1, this.options.maxWiggleDeg, true);
            if ((this.large_turn_angle_deg > 0 && dangle < 0) || (this.large_turn_angle_deg < 0 && dangle > 0)) {
                dangle = -dangle; // ensures both values either + or -
            }
            this.large_turn_angle_deg -= dangle;
            this.angle_deg += dangle;
        }

        this.angle_rad = this.deg2rad(this.angle_deg);

        var dx = Math.cos(this.angle_rad) * this.options.walkSpeed * (delta / 100);
        var dy = -Math.sin(this.angle_rad) * this.options.walkSpeed * (delta / 100);

        this.moveBug((this.bug.left + dx), (this.bug.top + dy), (90 - this.angle_deg));
        this.walkFrame();

    },

    makeBug: function() {
        if (!this.bug) {
            var row = (this.wingsOpen) ? '0' : '-' + this.options.bugHeight + 'px',
                bug = document.createElement('div');
            bug.className = 'bug';
            bug.style.background = 'transparent url(' + this.options.imageSprite + ') no-repeat 0 ' + row;
            bug.style.width = this.options.bugWidth + 'px';
            bug.style.height = this.options.bugHeight + 'px';
            bug.style.position = 'fixed';
            bug.style.top = 0;
            bug.style.left = 0;
            bug.style.zIndex = '9999999';

            this.bug = bug;
            this.setPos();

        }

    },

    setPos: function(top, left) {
        this.bug.top = top || this.random(this.options.edge_resistance, document.documentElement.clientHeight - this.options.edge_resistance);

        this.bug.left = left || this.random(this.options.edge_resistance, document.documentElement.clientWidth - this.options.edge_resistance);

        this.moveBug(this.bug.left, this.bug.top, (90 - this.angle_deg));
    },

    moveBug: function(x, y, deg) {
        // keep track of where we are:
        this.bug.left = x;
        this.bug.top = y;

        // transform:
        var trans = "translate(" + parseInt(x) + "px," + parseInt(y) + "px)";
        if (deg) {
            //console.log("translate("+(x)+"px, "+(y)+"px) rotate("+deg+"deg)");
            trans += " rotate(" + deg + "deg)";
        }
        trans += " scale(" + this.zoom + ")";

        this.transform(trans);

    },

    drawBug: function(top, left) {

        if (!this.bug) {
            this.makeBug();
        }
        if (top && left) {
            this.setPos(top, left);
        } else {
            this.setPos(this.bug.top, this.bug.left)
        }
        if (!this.inserted) {
            this.inserted = true;
            document.body.appendChild(this.bug);
        }
    },

    toggleStationary: function() {
        this.stationary = !this.stationary;
        this.next_stationary();
        var ypos = (this.wingsOpen) ? '0' : '-' + this.options.bugHeight + 'px';
        if (this.stationary) {

            this.bug.style.backgroundPosition = '0 ' + ypos;
        } else {
            this.bug.style.backgroundPosition = '-' + this.options.bugWidth + 'px ' + ypos;
        }
    },

    walkFrame: function() {
        var xpos = (-1 * (this.walkIndex * this.options.bugWidth)) + 'px',
            ypos = (this.wingsOpen) ? '0' : '-' + this.options.bugHeight + 'px';
        this.bug.style.backgroundPosition = xpos + ' ' + ypos;
        this.walkIndex++;
        if (this.walkIndex >= this.options.num_frames) this.walkIndex = 0;
    },

    fly: function(landingPosition) {
        var currentTop = this.bug.top,
            currentLeft = this.bug.left,
            diffx = (currentLeft - landingPosition.left),
            diffy = (currentTop - landingPosition.top),
            angle = Math.atan(diffy / diffx);

        if (Math.abs(diffx) + Math.abs(diffy) < 50) {
            this.bug.style.backgroundPosition = (-2 * this.options.bugWidth) + 'px -' + (2 * this.options.bugHeight) + 'px';
        }
        if (Math.abs(diffx) + Math.abs(diffy) < 30) {
            this.bug.style.backgroundPosition = (-1 * this.options.bugWidth) + 'px -' + (2 * this.options.bugHeight) + 'px';
        }
        if (Math.abs(diffx) + Math.abs(diffy) < 10) {
            // close enough:
            this.bug.style.backgroundPosition = '0 0'; //+row+'px'));

            this.stop();
            this.go();
            //this.go.delay(100, this);

            return;

        }

        // make it wiggle: disabled becuase its just too fast to see... better would be to make its path wiggly.
        //angle = angle - (this.deg2rad(this.random(0,10)));
        //console.log('angle: ',this.rad2deg(angle));

        var dx = Math.cos(angle) * this.options.flySpeed,
            dy = Math.sin(angle) * this.options.flySpeed;

        if ((currentLeft > landingPosition.left && dx > 0) || (currentLeft > landingPosition.left && dx < 0)) {
            // make sure angle is right way
            dx = -1 * dx;
            if (Math.abs(diffx) < Math.abs(dx)) {
                dx = dx / 4;
            }
        }
        if ((currentTop < landingPosition.top && dy < 0) || (currentTop > landingPosition.top && dy > 0)) {
            dy = -1 * dy;
            if (Math.abs(diffy) < Math.abs(dy)) {
                dy = dy / 4;
            }
        }

        this.moveBug((currentLeft + dx), (currentTop + dy));

    },

    flyRand: function() {
        this.stop();
        var landingPosition = {};
        landingPosition.top = this.random(this.options.edge_resistance, document.documentElement.clientHeight - this.options.edge_resistance);
        landingPosition.left = this.random(this.options.edge_resistance, document.documentElement.clientWidth - this.options.edge_resistance);

        this.startFlying(landingPosition);
    },

    startFlying: function(landingPosition) {

        var currentTop = this.bug.top,
            currentLeft = this.bug.left,
            diffx = (landingPosition.left - currentLeft),
            diffy = (landingPosition.top - currentTop);

        this.bug.left = landingPosition.left;
        this.bug.top = landingPosition.top;

        this.angle_rad = Math.atan(diffy / diffx);
        this.angle_deg = this.rad2deg(this.angle_rad);

        if (diffx > 0) {
            // going left: quadrant 1 or 2
            this.angle_deg = 90 + this.angle_deg;
        } else {
            // going right: quadrant 3 or 4
            this.angle_deg = 270 + this.angle_deg;
        }

        this.moveBug(currentLeft, currentTop, this.angle_deg);

        // start animation:
        var that = this;
        this.flyperiodical = setInterval(function() {
            that.fly(landingPosition);
        }, 10);
    },

    flyIn: function() {
        if (!this.bug) {
            this.makeBug();
        }
        this.stop();
        // pick a random side:
        var side = Math.round(Math.random() * 4 - 0.5),
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            windowX = window.innerWidth || e.clientWidth || g.clientWidth,
            windowY = window.innerHeight || e.clientHeight || g.clientHeight;
        if (side > 3) side = 3;
        if (side < 0) side = 0;
        var style = {},
            s;
        if (side === 0) {
            // top:
            style.top = (-2 * this.options.bugHeight);
            style.left = Math.random() * windowX;
        } else if (side === 1) {
            // right:
            style.top = Math.random() * windowY;
            style.left = windowX + (2 * this.options.bugWidth);
        } else if (side === 2) {
            // bottom:
            style.top = windowY + (2 * this.options.bugHeight);
            style.left = Math.random() * windowX;
        } else {
            // left: 
            style.top = Math.random() * windowY;
            style.left = (-3 * this.options.bugWidth);
        }
        var row = (this.wingsOpen) ? '0' : '-' + this.options.bugHeight + 'px';
        this.bug.style.backgroundPosition = (-3 * this.options.bugWidth) + 'px ' + row;
        this.bug.top = style.top
        this.bug.left = style.left

        this.drawBug();

        // landing position:
        var landingPosition = {};
        landingPosition.top = this.random(this.options.edge_resistance, document.documentElement.clientHeight - this.options.edge_resistance);
        landingPosition.left = this.random(this.options.edge_resistance, document.documentElement.clientWidth - this.options.edge_resistance);

        this.startFlying(landingPosition);
    },

    walkIn: function() {
        if (!this.bug) {
            this.makeBug();
        }
        this.stop();
        // pick a random side:
        var side = Math.round(Math.random() * 4 - 0.5),
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            windowX = window.innerWidth || e.clientWidth || g.clientWidth,
            windowY = window.innerHeight || e.clientHeight || g.clientHeight;
        if (side > 3) side = 3;
        if (side < 0) side = 0;
        var style = {},
            s;
        if (side === 0) {
            // top:
            style.top = (-1.3 * this.options.bugHeight);
            style.left = Math.random() * windowX;
        } else if (side === 1) {
            // right:
            style.top = Math.random() * windowY;
            style.left = windowX + (0.3 * this.options.bugWidth);
        } else if (side === 2) {
            // bottom:
            style.top = windowY + (0.3 * this.options.bugHeight);
            style.left = Math.random() * windowX;
        } else {
            // left: 
            style.top = Math.random() * windowY;
            style.left = (-1.3 * this.options.bugWidth);
        }
        var row = (this.wingsOpen) ? '0' : '-' + this.options.bugHeight + 'px';
        this.bug.style.backgroundPosition = (-3 * this.options.bugWidth) + 'px ' + row;
        this.bug.top = style.top
        this.bug.left = style.left

        this.drawBug();

        // start walking:
        this.go();

    },

    flyOff: function() {
        this.stop();
        // pick a random side to fly off to, where 0 is top and continuing clockwise.
        var side = this.random(0, 3),
            style = {},
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            windowX = window.innerWidth || e.clientWidth || g.clientWidth,
            windowY = window.innerHeight || e.clientHeight || g.clientHeight;

        if (side === 0) {
            // top:
            style.top = -200;
            style.left = Math.random() * windowX;
        } else if (side === 1) {
            // right:
            style.top = Math.random() * windowY;
            style.left = windowX + 200;
        } else if (side === 2) {
            //bottom:
            style.top = windowY + 200;
            style.left = Math.random() * windowX;
        } else {
            // left: 
            style.top = Math.random() * windowY;
            style.left = -200;
        }
        this.startFlying(style);
    },

    die: function() {
        this.stop();
        //pick death style:
        var deathType = this.random(0, this.options.numDeathTypes - 1);

        this.alive = false;
        this.drop(deathType);
    },

    drop: function(deathType) {
        var startPos = this.bug.top,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            finalPos = window.innerHeight || e.clientHeight || g.clientHeight,
            finalPos = finalPos - this.options.bugHeight,
            rotationRate = this.random(0, 20, true),
            startTime = Date.now(),
            that = this;

        this.dropTimer = requestAnimFrame(function(t) {
            this._lastTimestamp = t;
            that.dropping(t, startPos, finalPos, rotationRate, deathType);
        });

    },

    dropping: function(t, startPos, finalPos, rotationRate, deathType) {
        var elapsedTime = t - this._lastTimestamp,
            deltaPos = (0.002 * (elapsedTime * elapsedTime)),
            newPos = startPos + deltaPos;
        //console.log(t, elapsedTime, deltaPos, newPos);

        var that = this;


        if (newPos >= finalPos) {
            newPos = finalPos;
            clearTimeout(this.dropTimer);



            this.angle_deg = 0;
            this.angle_rad = this.deg2rad(this.angle_deg);
            this.transform("rotate(" + (90 - this.angle_deg) + "deg) scale(" + this.zoom + ")");
            this.bug.style.top = null;
            // because it is (or might be) zoomed and rotated, we cannot just just bottom = 0. Figure out real bottom position:
            var rotationOffset = ((this.options.bugWidth * this.zoom) - (this.options.bugHeight * this.zoom)) / 2;
            var zoomOffset = ((this.options.bugHeight) / 2) * (1 - this.zoom);
            this.bug.style.bottom = Math.ceil((rotationOffset - zoomOffset)) + 'px'; // because its rotated and zoomed.
            this.bug.style.left = this.bug.left + 'px';
            this.bug.style.backgroundPosition = '-' + ((deathType * 2) * this.options.bugWidth) + 'px 100%';


            this.twitch(deathType);

            return;
        }

        this.dropTimer = requestAnimFrame(function(t) {
            that.dropping(t, startPos, finalPos, rotationRate, deathType);
        });

        if (elapsedTime < 20) return;

        this.angle_deg = ((this.angle_deg + rotationRate) % 360);
        this.angle_rad = this.deg2rad(this.angle_deg);

        this.moveBug(this.bug.left, newPos, this.angle_deg);
    },

    twitch: function(deathType, legPos) {
        //this.bug.style.back
        if (!legPos) legPos = 0;
        var that = this;
        if (deathType === 0 || deathType === 1) {
            that.twitchTimer = setTimeout(function() {
                that.bug.style.backgroundPosition = '-' + ((deathType * 2 + (legPos % 2)) * that.options.bugWidth) + 'px 100%';
                that.twitchTimer = setTimeout(function() {
                    legPos++;
                    that.bug.style.backgroundPosition = '-' + ((deathType * 2 + (legPos % 2)) * that.options.bugWidth) + 'px 100%';
                    that.twitch(deathType, ++legPos);
                }, that.random(300, 800));
            }, this.random(1000, 10000));
        }
    },

    /* helper methods: */
    rad2deg: function(rad) {
        return rad * this.rad2deg_k;
    },
    deg2rad: function(deg) {
        return deg * this.deg2rad_k;
    },
    random: function(min, max, plusminus) {
        if (min == max) return min;
        var result = Math.round(min - 0.5 + (Math.random() * (max - min + 1)));
        if (plusminus) return Math.random() > 0.5 ? result : -result;
        return result;
    },

    next_small_turn: function() {
        this.small_turn_counter = Math.round(Math.random() * 10);
    },
    next_large_turn: function() {
        this.large_turn_counter = Math.round(Math.random() * 40);
    },
    next_stationary: function() {
        this.toggle_stationary_counter = this.random(50, 300);
    },

    bug_near_window_edge: function() {
        this.near_edge = 0;
        if (this.bug.top < this.options.edge_resistance)
            this.near_edge |= this.NEAR_TOP_EDGE;
        else if (this.bug.top > document.documentElement.clientHeight - this.options.edge_resistance)
            this.near_edge |= this.NEAR_BOTTOM_EDGE;
        if (this.bug.left < this.options.edge_resistance)
            this.near_edge |= this.NEAR_LEFT_EDGE;
        else if (this.bug.left > document.documentElement.clientWidth - this.options.edge_resistance)
            this.near_edge |= this.NEAR_RIGHT_EDGE;
        return this.near_edge;
    },

    getPos: function() {
        if (this.inserted && this.bug && this.bug.style) {
            return {
                'top': parseInt(this.bug.top, 10),
                'left': parseInt(this.bug.left, 10)
            };
        }
        return null;
    }

};

var SpawnBug = function() {
    var newBug = {},
        prop;
    for (prop in Bug) {
        if (Bug.hasOwnProperty(prop)) {
            newBug[prop] = Bug[prop];
        }
    }
    return newBug;
};

// debated about which pattern to use to instantiate each bug...
// see http://jsperf.com/obj-vs-prototype-vs-other



/**
 * Helper methods:
 **/

var mergeOptions = function(obj1, obj2, clone) {
    if (typeof(clone) == 'undefined') {
        clone = true;
    }
    var newobj = (clone) ? cloneOf(obj1) : obj1;
    for (var key in obj2) {
        if (obj2.hasOwnProperty(key)) {
            newobj[key] = obj2[key];
        }
    }
    return newobj;
};

var cloneOf = function(obj) {
    if (obj == null || typeof(obj) != 'object')
        return obj;

    var temp = obj.constructor(); // changed

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            temp[key] = cloneOf(obj[key]);
        }
    }
    return temp;
}

/* Request animation frame polyfill */
/* http://paulirish.com/2011/requestanimationframe-for-smart-animating/ */
window.requestAnimFrame = (function() {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame || function( /* function */ callback, /* DOMElement */ element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();
