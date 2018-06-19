miaou(function(tableControls, md, plugins){

	const DAT_KEY = "table-controller";

	function diff(a, b){
		if (a > b) return 1;
		if (a < b) return -1;
		return 0;
	}

	function numDiff(a, b){
		if (a != a) {
			return b!=b ? 0 : -1;
		}
		if (b != b) return 1;
		return diff(a, b);
	}

	const sortFunctions = {
		"number-up": function(a, b){
			var	na = toNumber(a.cells[this].textContent),
				nb = toNumber(b.cells[this].textContent);
			return numDiff(na, nb);
		},
		"number-down": function(a, b){
			var	na = toNumber(a.cells[this].textContent),
				nb = toNumber(b.cells[this].textContent);
			return numDiff(nb, na);
		},
		"name-up": function(a, b){
			var	na = a.cells[this].textContent.toLowerCase(),
				nb = b.cells[this].textContent.toLowerCase();
			return diff(na, nb);
		},
		"name-down": function(a, b){
			var	na = a.cells[this].textContent.toLowerCase(),
				nb = b.cells[this].textContent.toLowerCase();
			return diff(nb, na);
		}
	};

	function toNumber(s){
		var m = s.replace(/\s+/g, '').match(/-?\d+(\.\d+)?/);
		return m ? +m[0] : NaN;
	}

	function ColumnController(tblCon, index){
		this.tblCon = tblCon;
		this.index = index;
		this.$th = tblCon.$head.find("th").eq(index);
		this.name = this.$th.text();
		this.nbAlphaCells = 0;
		this.nbNumCells = 0;
		var n = tblCon.$rows.length;
		for (var i=n; i-->1;) {
			var txt = tblCon.$rows.eq(i).find("td").eq(index).text();
			if (!txt) continue;
			txt = txt.trim();
			if (/\d+/.test(txt)) this.nbNumCells++;
			this.nbAlphaCells++;
		}
		this.isNumSortable = this.nbNumCells >= n*.5
			|| (this.nbNumCells >= .9*this.nbAlphaCells && this.nbNumCells>2);
		this.isAlphaSortable = this.nbAlphaCells >= n*.6 && this.nbNumCells < .9*n;
	}
	ColumnController.prototype.appendTo = function($c){
		var	cc = this;
		var 	$cc = $("<div class=column-controller>").text("sort:").appendTo($c);
		function addIcon(key){
			var $i = $("<span>").addClass("icon-sort icon-sort-"+key)
			.click(function(){
				cc.tblCon.sort(key, cc.index);
			})
			.appendTo($cc);
			if (cc.tblCon.lastApplied == key + cc.index) {
				$i.addClass("active");
			}
		}
		if (this.isNumSortable) {
			addIcon("number-up");
			addIcon("number-down");
		}
		if (this.isAlphaSortable) {
			addIcon("name-up");
			addIcon("name-down");
		}
	}

	function GraphController(tg){
		this.tg = tg; // the tableGraph given by the graph plugin
	}
	GraphController.prototype.appendTo = function($c, index){
		var tg = this.tg;
		if (!tg.rendered()) {
			$("<button>").addClass("tbl-graph-toggle").text("graph this table")
			.click(function(){
				md.opendIfClosed(tg.$table.closest(".message"));
				tg.render();
			})
			.appendTo($c);
			return;
		}
		$("<button>").addClass("tbl-graph-toggle").text("hide the graph")
		.click(function(){
			tg.remove();
		})
		.appendTo($c);
		var col = tg.cols[index];
		if (!col.xvals && !col.yvals) return;
		var $d = $("<div>").addClass("tbl-graph-col-choice").appendTo($c);
		$("<span>").text("graph this column: ").appendTo($d);
		if (col.xvals) {
			let $label = $("<label>").text("x").appendTo($d);
			let $input = $("<input type=radio>").prependTo($label);
			if (col==tg.choice.xcol) {
				$input.prop("checked", true);
			} else {
				$input.prop("checked", false).click(e=>{
					tg.setAsX(col);
				});
			}
		}
		if (col.yvals) {
			let $label = $("<label>").text("y").appendTo($d);
			let $input = $("<input type=radio>").prependTo($label);
			if (tg.choice.ycols.includes(col)) {
				$input.prop("checked", true);
			} else {
				$input.prop("checked", false).click(e=>{
					tg.setAsY(col);
				});
			}
		}
		if (col.yvals.length>1) {
			let $label = $("<label>").text("no").appendTo($d);
			let $input = $("<input type=radio>").prependTo($label);
			if (tg.choice.xcol===col || tg.choice.ycols.includes(col)) {
				$input.prop("checked", false).click(e=>{
					tg.ignore(col);
				});
			} else {
				$input.prop("checked", true);
			}
		}
	}

	function TableController($table){
		this.$table = $table;
		this.$rows = $table.find("tr");
		this.$head = this.$rows.eq(0);
		this.$rows = this.$rows.slice(1);
		this.cols = [];
		this.lastApplied = null; // syntax: <key><col index>
		for (var i = this.$head.find("th").length; i--; ) {
			this.cols[i] = new ColumnController(this, i);
		}
		this.graphController = null;
		if (plugins.graph) {
			var tg = plugins.graph.tableGraph($table);
			if (tg && tg.renderable) {
				this.graphController = new GraphController(tg);
			}
		}
		this.sortable = this.$rows.length > 2;
	}

	TableController.prototype.sort = function(key, index){
		var rows = this.$table.find("tr").slice(1).remove().get();
		if (this.lastApplied == key+index) {
			// reset to original ordering
			rows = this.$rows;
			this.lastApplied = null;
			key = null;
		} else {
			// sort according to supplied key
			rows.sort(sortFunctions[key].bind(index));
			this.lastApplied = key+index;
		}
		this.$table.append(rows);
		$(".column-controller span").each(function(){
			this.classList.toggle("active", this.classList.contains("icon-sort-"+key));
		});
		if (this.graphController) {
			var tg = this.graphController.tg;
			if (tg.rendered()) {
				tg.readCols();
				tg.render();
			}
		}
	}

	TableController.prototype.colController = function($th){
		return this.cols[$th.index()];
	}

	function getTableController($table){
		var tblCon = $table.dat(DAT_KEY);
		if (!tblCon) {
			$table.dat(DAT_KEY, tblCon = new TableController($table))
			.addClass("controlled");
		}
		return tblCon;
	}

	function blow($c, $th){
		var	$table = $th.closest("table"),
			tblCon = getTableController($table),
			graphCon = tblCon.graphController,
			hasContent = false;
		if (graphCon) {
			graphCon.appendTo($c, $th.index());
			hasContent = true;
		}
		if (tblCon.sortable) {
			var colCon = tblCon.colController($th);
			colCon.appendTo($c);
			hasContent = true;
		}
		return hasContent;
	}

	$("#messages").bubbleOn(".content th", {
		side: "top",
		blower: function($c){
			return blow($c, $(this));
		}
	});

});
