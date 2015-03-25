
/* Parts are taken from
 *  fireworks.js - Kenneth Kufluk (http://kenneth.kufluk.com/)
 *  http://js-fireworks.appspot.com/
 *  MIT (X11) Licensed
 */

//  The script I used as starting point isn't pretty.
//  I fixed a few things, but not the whole.
//  I only took it because I wanted to have my fireworks running in a few minutes.

miaou(function(){

	var text = "ONE MILLION MESSAGES!";

	var FireworkDisplay = {
		GRAVITY : 5,
		FRAME_RATE : 30,
		DEPLOYMENT_RATE : 10,
		FIREWORK_SPEED : 1.5,
		DISPERSION_WIDTH : 1,
		DISPERSION_HEIGHT : 2,
		FIREWORK_PAYLOAD : 30,
		FRAGMENT_SPREAD : 8,
		TEXT_LINE_HEIGHT : 90,
		DOT_RADIUS: 3.5,
		FIREWORK_READY : 0,
		FIREWORK_LAUNCHED : 1,
		FIREWORK_EXPLODED : 2,
		FIREWORK_FRAGMENT : 3,
		canvas : 0,
		canvaswidth : 0,
		canvasheight : 0,
		ctx : 0,
		blockPointer : 0,
		fireworks : [],
		allBlocks : new Array(),
		gameloop : 0,
		
		updateDisplay : function() {
			this.ctx.clearRect(0, 0, this.canvaswidth, this.canvasheight);
			var firecount = 0;
			for (var i=0;i<this.fireworks.length;i++) {
				if (this.fireworks[i]==null) continue; 
				if (this.fireworks[i].status!=this.FIREWORK_EXPLODED) {
					firecount++;
				}
				this.displayFirework(this.fireworks[i]);
			}
			if (firecount == 0) {
				$('#cv').delay(8000).fadeOut(8000, function(){
					$('#cv').remove();
					clearInterval(FireworkDisplay.gameloop);
				});
			}
		},

		launchFirework : function(fw, dispersion, speed) {
			fw.dx = dispersion;
			fw.dy = speed;
			fw.status = this.FIREWORK_LAUNCHED;
		},
		disperseFirework : function(fw, speed) {
			fw.dx = speed * (0.5-Math.random());
			fw.dy = speed * (0.5-Math.random()) + 1;
		},
		explodeFirework : function(fw, speed) {
			fw.status = this.FIREWORK_EXPLODED;
			fw.r = (Math.random() /2) + 0.5;
			fw.g = (Math.random() /2) + 0.5;
			fw.b = (Math.random() /2) + 0.5;
			fw.brightness = 200;
			this.ctx.strokeStyle = "rgb(200, 200, 200)";
			// add the fragments
			var frags = Math.random() * this.FIREWORK_PAYLOAD;
			for (var i=0;i<frags;i++) { 
				var spark = this.fireworks[this.fireworks.length] = new Firework(this.fireworks.length);
				spark.x = fw.x;
				spark.y = fw.y;
				spark.r = fw.r;
				spark.g = fw.g;
				spark.b = fw.b;
				spark.status = this.FIREWORK_FRAGMENT;
				this.disperseFirework(spark, Math.random()*this.FRAGMENT_SPREAD);
			}
		},
		destroyFirework : function(fw) {
			this.fireworks[fw.index] = null;
		},
		displayFirework : function(fw, speed) {
			if (fw.y<0) this.destroyFirework(fw);
			if (fw.status==this.FIREWORK_EXPLODED) {
				this.ctx.beginPath();
				this.ctx.fillStyle = "gold";
				this.ctx.shadowBlur = 6;
				this.ctx.shadowColor = "#ab1a3e";
				this.ctx.arc(fw.x, this.canvas.height-fw.y, this.DOT_RADIUS, 0, Math.PI*2, true);
				this.ctx.fill();
				this.ctx.shadowBlur = 0;
				this.ctx.shadowColor = "#ab1a3e";
				return;
			}
			fw.colour = "rgb(80, 80, 80)";
			this.ctx.strokeStyle = fw.colour;
			var forces = {x:0,y:-0.05};
			if (fw.status==this.FIREWORK_FRAGMENT) {
				forces.y = this.GRAVITY/-100;
				fw.colour = "rgb("+Math.round(fw.r*fw.brightness)+", "+Math.round(fw.g*fw.brightness)+", "+Math.round(fw.b*fw.brightness)+")";
				this.ctx.strokeStyle = fw.colour;
				fw.brightness-=5;
				if (fw.brightness<0) this.destroyFirework(fw);
			}
			if (fw.dy<-1 && fw.status==this.FIREWORK_LAUNCHED) {
				this.explodeFirework(fw);
			}
			fw.start = {x:fw.x, y:fw.y};
			//apply accelerations
			fw.dx += forces.x*this.FIREWORK_SPEED;
			fw.dy += forces.y*this.FIREWORK_SPEED;
			//apply velocities
			fw.x += fw.dx*this.FIREWORK_SPEED;
			fw.y += fw.dy*this.FIREWORK_SPEED;
			//show
			if (fw.previous) {
				this.ctx.beginPath();
				this.ctx.moveTo(fw.previous.x, this.canvas.height-fw.previous.y);
				this.ctx.lineTo(fw.x, this.canvas.height-fw.y);
				this.ctx.stroke();
				this.ctx.closePath();
			}
			fw.previous = {x:fw.start.x, y:fw.start.y};
		}
	}

	FireworkDisplay.addFireworks = function() {
		if (this.blockPointer>=this.allBlocks.length) {
			return;
		}
		var fw = this.fireworks[this.fireworks.length] = new Firework(this.fireworks.length);
		var targetx = this.allBlocks[this.blockPointer][0];
		targetx = (((targetx)) / 300) * this.DISPERSION_HEIGHT;
		var targety = this.allBlocks[this.blockPointer][1];
		targety = (((10-targety) / 100) * this.DISPERSION_WIDTH) + 3.5;
		this.launchFirework(fw, targetx, targety);
		this.blockPointer++;
		setTimeout(FireworkDisplay.addFireworks.bind(FireworkDisplay), 1000/this.DEPLOYMENT_RATE);
	}
	
	FireworkDisplay.launchText =  function() {

		this.fireworks = [];
		this.blockPointer = 0;
		clearTimeout(this.gameloop);
		//CANVAS
		this.canvas = $("#cv").get(0);
		this.ctx = this.canvas.getContext("2d");
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.lineWidth = "2";
		this.ctx.strokeStyle = "rgb(255, 255, 255)";
		this.canvaswidth = $(window).width();
		this.canvasheight = $(window).height();

		var totalHeightOffset = 0;
		var totalWidthOffset = [];
		var widthCounter = 0;
		totalWidthOffset[widthCounter] = 0;
		for (var i=0;i<text.length;i++) {
			if (text.charAt(i)==' ') {
				totalHeightOffset += this.TEXT_LINE_HEIGHT;
				widthCounter++;
				totalWidthOffset[widthCounter] = 0;
			} else {
				var maxWidthOffset = 0;
				for (var j=0;j<FONT_FIREWORK[text.charAt(i)].length;j++) {
					var chararr = FONT_FIREWORK[text.charAt(i)][j];
					maxWidthOffset = Math.max(maxWidthOffset, chararr[0]);
				}
				totalWidthOffset[widthCounter] += maxWidthOffset + 40;
			}
		}

		this.allBlocks = [];
		var windowHeight = $(window).height();
		var offsetTop = totalHeightOffset;
		offsetTop += (windowHeight-totalHeightOffset)/6;
		var offsetLeft = 0;
		var heightOffsetCount = 0;
		for (var i=0;i<text.length;i++) {
			if (text.charAt(i)==' ') {
				heightOffsetCount++;
				offsetTop = offsetTop - this.TEXT_LINE_HEIGHT;
				offsetLeft = 0;
			} else {
				var maxWidthOffset = 0;
				for (var j=0;j<FONT_FIREWORK[text.charAt(i)].length;j++) {
					var chararr = FONT_FIREWORK[text.charAt(i)][j];
					this.allBlocks[this.allBlocks.length] = [(chararr[0]+offsetLeft)-(totalWidthOffset[heightOffsetCount]/2), chararr[1]-offsetTop];
					maxWidthOffset = Math.max(maxWidthOffset, chararr[0]);
				}
				offsetLeft += maxWidthOffset+40;  //plus character spacing
			}
		}

		this.gameloop = setInterval(FireworkDisplay.updateDisplay.bind(FireworkDisplay), 1000/this.FRAME_RATE);
		this.addFireworks();			
	}

	Firework = function(index) {
		this.index = index;
		this.dx = 0;
		this.dy = 0;
		this.x = FireworkDisplay.canvaswidth/2;
		this.y = 0;
		this.status = FireworkDisplay.FIREWORK_READY;
		this.brightness = 255;
		this.r = 1;
		this.g = 1;
		this.b = 1;
		this.start = {x:0, y:0};
		this.previous = 0;
	}

	var FONT_FIREWORK = {"!":[[5,-40],[5,-30],[5,-20],[5,0]],"\"":[[20,-40],[20,-30],[5,-40],[5,-30]],"#":[[35,-40],[45,-30],[35,-30],[15,-40],[25,-30],[35,-20],[45,-10],[15,-30],[35,-10],[5,-30],[15,-20],[25,-10],[35,0],[15,-10],[5,-10],[15,0]],"%":[[45,-40],[35,-30],[15,-40],[45,-10],[5,-40],[15,-30],[25,-20],[35,-10],[45,0],[5,-30],[35,0],[15,-10],[5,0]],"&":[[35,-40],[25,-40],[35,-30],[15,-40],[35,-20],[15,-30],[25,-20],[15,-20],[25,-10],[35,0],[5,-20],[25,0],[5,-10],[15,0],[25,10],[5,0]],"'":[[5,-40],[5,-30]],"(":[[15,-40],[5,-30],[5,-20],[5,-10],[15,0]],")":[[5,-40],[15,-30],[15,-20],[15,-10],[5,0]],"*":[[25,-40],[5,-40],[15,-30],[25,-20],[5,-20]],"+":[[20,-40],[35,-20],[20,-30],[25,-20],[15,-20],[20,-10],[5,-20],[20,0]],",":[[5,0],[5,10]],"-":[[35,-20],[25,-20],[15,-20],[5,-20]],"-":[[35,-20],[25,-20],[15,-20],[5,-20]],".":[[5,0]],"/":[[45,-40],[35,-30],[25,-20],[15,-10],[5,0]],":":[[5,-30],[5,-10]],";":[[5,-30],[5,-10],[5,0]],"<":[[15,-25],[5,-15],[15,-5]],"=":[[35,-30],[25,-30],[15,-30],[35,-10],[5,-30],[25,-10],[15,-10],[5,-10]],">":[[5,-25],[15,-15],[5,-5]],"?":[[35,-40],[25,-40],[35,-30],[15,-40],[35,-20],[5,-40],[25,-20],[15,-20],[15,0]],"@":[[35,-30],[25,-40],[15,-40],[35,-20],[25,-20],[35,-10],[5,-30],[35,0],[15,-15],[5,-20],[25,0],[15,-5],[5,-10],[15,5],[5,0]],"A":[[35,-30],[25,-40],[15,-40],[35,-20],[25,-20],[35,-10],[5,-30],[15,-20],[35,0],[5,-20],[5,-10],[5,0]],"B":[[25,-40],[15,-40],[25,-30],[35,-20],[5,-40],[25,-20],[35,-10],[5,-30],[15,-20],[35,0],[5,-20],[25,0],[5,-10],[15,0],[5,0]],"C":[[35,-40],[25,-40],[15,-40],[5,-30],[35,0],[5,-20],[25,0],[5,-10],[15,0]],"D":[[35,-30],[25,-40],[15,-40],[35,-20],[5,-40],[35,-10],[5,-30],[5,-20],[25,0],[5,-10],[15,0],[5,0]],"E":[[35,-40],[25,-40],[15,-40],[5,-40],[25,-20],[5,-30],[15,-20],[35,0],[5,-20],[25,0],[5,-10],[15,0],[5,0]],"F":[[35,-40],[25,-40],[15,-40],[5,-40],[25,-20],[5,-30],[15,-20],[5,-20],[5,-10],[5,0]],"G":[[35,-40],[25,-40],[15,-40],[35,-20],[25,-20],[35,-10],[5,-30],[35,0],[5,-20],[25,0],[5,-10],[15,0]],"H":[[35,-40],[35,-30],[35,-20],[5,-40],[25,-20],[35,-10],[5,-30],[15,-20],[35,0],[5,-20],[5,-10],[5,0]],"I":[[25,-40],[15,-40],[5,-40],[15,-30],[15,-20],[15,-10],[25,0],[15,0],[5,0]],"J":[[35,-40],[25,-40],[35,-30],[35,-20],[35,-10],[25,0],[5,-10],[15,0]],"K":[[35,-40],[25,-30],[5,-40],[25,-20],[35,-10],[5,-30],[15,-20],[35,0],[5,-20],[5,-10],[5,0]],"L":[[5,-40],[5,-30],[35,0],[5,-20],[25,0],[5,-10],[15,0],[5,0]],"M":[[35,-40],[35,-30],[25,-30],[35,-20],[5,-40],[15,-30],[35,-10],[20,-20],[5,-30],[35,0],[5,-20],[5,-10],[5,0]],"N":[[35,-40],[35,-30],[35,-20],[5,-40],[15,-30],[25,-20],[35,-10],[5,-30],[35,0],[5,-20],[5,-10],[5,0]],"O":[[35,-30],[25,-40],[15,-40],[35,-20],[35,-10],[5,-30],[5,-20],[25,0],[5,-10],[15,0]],"P":[[35,-30],[25,-40],[15,-40],[5,-40],[25,-20],[5,-30],[15,-20],[5,-20],[5,-10],[5,0]],"Q":[[35,-30],[25,-40],[15,-40],[35,-20],[35,-10],[5,-30],[25,-10],[35,0],[5,-20],[25,0],[5,-10],[15,0]],"R":[[35,-30],[25,-40],[15,-40],[5,-40],[25,-20],[35,-10],[5,-30],[15,-20],[35,0],[5,-20],[5,-10],[5,0]],"S":[[35,-35],[25,-40],[15,-40],[35,-15],[25,-20],[5,-35],[35,-5],[15,-20],[5,-25],[25,0],[15,0],[5,-5]],"T":[[35,-40],[25,-40],[15,-40],[20,-30],[5,-40],[20,-20],[20,-10],[20,0]],"U":[[35,-40],[35,-30],[35,-20],[5,-40],[35,-10],[5,-30],[5,-20],[25,0],[5,-10],[15,0]],"V":[[35,-40],[35,-30],[35,-20],[5,-40],[5,-30],[25,-10],[5,-20],[15,-10],[20,0]],"W":[[35,-40],[35,-30],[20,-40],[35,-20],[20,-30],[5,-40],[35,-10],[20,-20],[5,-30],[35,0],[20,-10],[5,-20],[25,0],[5,-10],[15,0]],"X":[[35,-40],[25,-30],[5,-40],[15,-30],[20,-20],[25,-10],[35,0],[15,-10],[5,0]],"Y":[[35,-40],[35,-30],[5,-40],[25,-20],[5,-30],[15,-20],[20,-10],[20,0]],"Z":[[35,-40],[25,-40],[15,-40],[25,-30],[5,-40],[20,-20],[35,0],[15,-10],[25,0],[15,0],[5,0]],"_":[[45,0],[35,0],[25,0],[15,0],[5,0]],"a":[[25,-30],[35,-20],[15,-30],[35,-10],[25,-15],[5,-30],[35,0],[15,-15],[25,0],[5,-10],[15,0]],"b":[[25,-30],[35,-20],[5,-40],[15,-30],[35,-10],[5,-30],[5,-20],[25,0],[5,-10],[15,0],[5,0]],"c":[[35,-30],[25,-30],[15,-30],[35,0],[5,-20],[25,0],[5,-10],[15,0]],"d":[[35,-40],[35,-30],[25,-30],[35,-20],[15,-30],[35,-10],[35,0],[5,-20],[25,0],[5,-10],[15,0]],"e":[[25,-30],[35,-20],[15,-30],[25,-15],[35,0],[15,-15],[5,-20],[25,0],[5,-10],[15,0]],"f":[[25,-40],[15,-40],[25,-20],[5,-30],[15,-20],[5,-20],[5,-10],[5,0]],"g":[[35,-30],[25,-30],[35,-20],[15,-30],[35,-10],[25,-10],[35,0],[5,-20],[15,-10],[25,10],[15,10],[5,10]],"h":[[5,-40],[25,-20],[35,-10],[5,-30],[15,-20],[35,0],[5,-20],[5,-10],[5,0]],"i":[[5,-40],[5,-20],[5,-10],[5,0]],"j":[[15,-40],[15,-20],[15,-10],[15,0],[5,10]],"k":[[35,-30],[5,-40],[25,-20],[35,-10],[5,-30],[15,-20],[35,0],[5,-20],[5,-10],[5,0]],"l":[[5,-40],[5,-30],[5,-20],[5,-10],[15,0]],"m":[[35,-30],[45,-20],[25,-30],[45,-10],[15,-30],[25,-20],[45,0],[5,-30],[25,-10],[5,-20],[25,0],[5,-10],[5,0]],"n":[[25,-30],[35,-20],[15,-30],[35,-10],[5,-30],[35,0],[5,-20],[5,-10],[5,0]],"o":[[25,-30],[35,-20],[15,-30],[35,-10],[5,-20],[25,0],[5,-10],[15,0]],"p":[[25,-30],[35,-20],[15,-30],[35,-10],[5,-30],[5,-20],[25,0],[5,-10],[15,0],[5,0],[5,10]],"q":[[35,-30],[25,-30],[35,-20],[15,-30],[35,-10],[35,0],[5,-20],[25,0],[35,10],[5,-10],[15,0]],"r":[[35,-30],[25,-30],[5,-30],[15,-20],[5,-20],[5,-10],[5,0]],"s":[[35,-30],[25,-30],[15,-30],[35,-10],[25,-15],[15,-15],[5,-20],[25,0],[15,0],[5,0]],"t":[[25,-30],[5,-40],[15,-30],[5,-30],[5,-20],[25,0],[5,-10],[15,0]],"u":[[35,-30],[35,-20],[35,-10],[5,-30],[35,0],[5,-20],[25,0],[5,-10],[15,0]],"v":[[35,-30],[35,-20],[5,-30],[25,-10],[5,-20],[15,-10],[20,0]],"w":[[35,-30],[35,-20],[20,-30],[35,-10],[20,-20],[5,-30],[35,0],[20,-10],[5,-20],[25,0],[5,-10],[15,0]],"x":[[35,-30],[25,-20],[5,-30],[15,-20],[25,-10],[35,0],[15,-10],[5,0]],"y":[[35,-30],[35,-20],[35,-10],[5,-30],[25,-10],[35,0],[5,-20],[15,-10],[25,10],[15,10]],"z":[[35,-30],[25,-30],[15,-30],[25,-20],[5,-30],[35,0],[15,-10],[25,0],[15,0],[5,0]],"0":[[35,-30],[25,-40],[15,-40],[35,-20],[35,-10],[15,-25],[25,-15],[5,-30],[5,-20],[25,0],[5,-10],[15,0]],"1":[[15,-40],[15,-30],[5,-30],[15,-20],[15,-10],[15,0]],"2":[[35,-35],[25,-40],[35,-25],[15,-40],[25,-20],[5,-35],[15,-20],[35,0],[25,0],[5,-10],[15,0],[5,0]],"3":[[25,-40],[35,-30],[15,-40],[5,-40],[25,-20],[35,-10],[15,-20],[25,0],[15,0],[5,0]],"4":[[35,-40],[35,-30],[35,-20],[5,-40],[25,-20],[35,-10],[5,-30],[15,-20],[35,0],[5,-20]],"5":[[35,-40],[25,-40],[15,-40],[35,-15],[5,-40],[25,-20],[35,-5],[5,-30],[15,-20],[5,-20],[25,0],[15,0],[5,0]],"6":[[35,-40],[25,-40],[15,-40],[35,-20],[25,-20],[35,-10],[5,-30],[15,-20],[5,-20],[25,0],[5,-10],[15,0]],"7":[[35,-40],[35,-30],[25,-40],[15,-40],[5,-40],[25,-20],[5,-30],[25,-10],[25,0]],"8":[[35,-35],[25,-40],[35,-25],[15,-40],[35,-15],[25,-20],[5,-35],[35,-5],[15,-20],[5,-25],[25,0],[5,-15],[15,0],[5,-5]],"9":[[35,-30],[25,-40],[15,-40],[35,-20],[25,-20],[35,-10],[5,-30],[15,-20],[5,-20],[25,0],[15,0],[5,0]]};

	var done = localStorage["no-fireworks"]||false;
	function start(){
		if (done) return;
		done = true;
		setTimeout(function(){
			$('<canvas id="cv" width="'+$(window).width()+'" height="'+($(window).height()-100)+'">')
			.css({
				position:"fixed", left:0, top:0, bottom:0, right:0, zIndex:500,
				pointerEvents:"none"	
			}).appendTo('body');
			FireworkDisplay.launchText();
		}, 1500);		
	}

	if (vis()) start();
	else vis(start);

});
