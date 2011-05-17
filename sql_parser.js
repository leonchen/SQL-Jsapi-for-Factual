Klass.create('Jsapi.Sql.SqlParser', {
  selectSqlRegExp: new RegExp("^select\\s([\\s_a-z0-9,]*[_a-z0-9*])\\s+from\\s+([\\w]{6})(\\s.+[^\\s;])?[\\s;]*$", "i"),
  inputSqlRegExp: new RegExp("^insert\\s+into\\s+([\\w]{6})\\s+\\(([\\s_a-z0-9,$]+)\\)\\s+values\\s+\\((.+)\\)[\\s;]*$"),
  defaultLimit: 20,
  defaultOffset: 0,

  parseRead: function (sql) {
    var m = sql.match(self.selectSqlRegExp);

    var res        = {};
    res.fields     = _parseSelect(m[1]);
    res.table      = _parseTable(m[2]);

    var statements = m[3];
    if (m[3] && m[3].length > 7) {
      var statements = _parseStatements(m[3]);
      var sort = _parseSort(statements); 
      if (sort) res.sort = sort;

      var limit = _parseLimit(statements);
      if (limit > 0) res.limit = limit;

      var offset = _parseOffset(statements);
      if (offset >= 0) res.offset = offset;

      var filters = _parseWhere(statements);
      if (filters) {
        if (filters.$subject_key) {
          res.subject_key = filters.$subject_key['$eq'];
        } else {
          res.filters = JSON.stringify(filters);
        }
      }
    }
    return res;
  },

  parseInput: function (sql) {
    var m = sql.match(self.inputSqlRegExp);
    
    var res = {};
    res.table  = _parseTable(m[1]);
    var fields = _parseSelect(m[2]);
    var values = _parseValues(m[3]); 

    var valuesHash = _getInputValues(fields, values);
    if (valuesHash.$subject_key) {
      res.subject_key = valuesHash.$subject_key;
      delete valuesHash.$subject_key;
    }
    res.values = JSON.stringify(valuesHash); 

    return res;
  },

  _parseSelect: function (s) {
    var fields = $.map(s.split(','), function (v, i) {
      return $.trim(v);
    });
    return fields;
  },

  _parseTable: function (s) {
    return $.trim(s);
  },

  _parseValues: function (s) {
    var statements = _parseStatements(s);
    return $.grep(statements, function (v, i) {
      return i%2 == 0;
    }); 
  },

  _getInputValues: function (fields, values) {
    var hash = {};
    for (var i=0,len=fields.length; i<len; i++) {
      if (values[i] !== undefined) hash[fields[i]] = values[i];
    }
    return hash;
  },

  _parseStatements: function (s) {
    var len = s.length;
    var statements = [];
    var inQuote = false;
    var inEscape = false;
    var inOperator = false;
    var unit = [];
    for (var i=0;i<len;i++) {
      var c = s[i];
      if (inQuote) {
        if (c == "'" && !inEscape) {
          inQuote = false;
          if (unit.length > 0) statements.push(unit.join(''));
          unit = [];
        } else if (c == '\\' && !inEscape) {
          inEscape = true;
        } else if (inEscape) {
          inEscape = false;
          unit.push(c);
        } else {
          unit.push(c);
        }
      } else {
        if (c == "'" || /\s/.test(c)) {
          inQuote = c == "'";
          inOperator = false;
          if (unit.length > 0) statements.push(unit.join('').toLowerCase());
          unit = [];
        } else if (c == '(' || c == ')') {
          inOperator = false;
          if (unit.length > 0) statements.push(unit.join('').toLowerCase());
          statements.push(c);
          unit = [];
        } else if ((/[_\w$.\-]/.test(c) && inOperator) || (/[^_\w.\-$]/.test(c) && !inOperator)) {
          inOperator = !inOperator;
          if (unit.length > 0) statements.push(unit.join('').toLowerCase());
          unit = [c];
        } else {
          unit.push(c);
        }
      }
      if (i == len-1 && unit.length > 0) statements.push(unit.join('').toLowerCase());
    }

    return statements;
  },

  _parseWhere: function (statements) {
    if (statements[0] != 'where') return null;
    statements.shift();

    var filters = Jsapi.Sql.SqlParser.FiltersNode.$new();
    var currentNode = filters; 
    var startPoint = true;
    for (var i=0,len=statements.length;i<len;i++) {
      var st = statements[i];
      if (st == '(' && !/^(\)|,)$/i.test(statements[i+2])) {
        var node = Jsapi.Sql.SqlParser.FiltersNode.$new();
        startPoint = true;
        node.parent = currentNode;
        currentNode.add(node);
        currentNode = node;
      } else if (st == ')') {
        startPoint = false;
        currentNode = currentNode.parent;
      } else if (startPoint == false && /^(or|and)$/i.test(st)){
        currentNode.logic = st;
        startPoint = true;
      } else if (startPoint == true) {
        var filter = Jsapi.Sql.SqlParser.FilterNode.$new();
        filter.field = st;
        if (statements[i+1] == 'is' && statements[i+2] == 'not' && statements[i+3] == 'null') {
          filter.operator = 'is';
          filter.value = 'notNull';
          i += 3;
        } else if (statements[i+2] == '(') {
          filter.operator = statements[i+1];
          var values = [];
          for (var j=i+3;j<len;j++){
            var v = statements[j];
            if (v == ')') break;
            if (v != ',') values.push(v);
          }
          filter.value = values;
          i = j;
        } else {
          filter.operator = statements[i+1];
          filter.value = statements[i+2];
          if (st == '$subject_key') return _buildFilter(filter);
          i+=2;
        }
        currentNode.add(filter);
        startPoint = false;
      }
    }

    return _parseFilters(filters); 
  },

  _parseFilters: function (filters) {
    if (filters.children) {
      var obj = {};
      if (filters.children.length == 1) {
        return _parseFilters(filters.children[0]);
      }
      var fs = [];
      $.each(filters.children, function (i, f) {
        fs.push(_parseFilters(f));
      }); 
      obj['$'+filters.logic] = fs;
      return obj;
    } else {
      return _buildFilter(filters);
    }
  },

  _buildFilter: function (f) {
    var field = f.field;
    var operator = f.operator;
    if (operator == null) throw('sql error: missing filter operator for ' + field);
    var value = f.value;
    if (value == null) throw('sql error: missing filter value for ' + field);

    var obj = {};
    if (field == '$location') {
      if (operator != 'within') throw('sql error: "$location" only support operator "within"');
      if (!((value instanceof Array) && value.length == 3)) throw('sql error: value for "$location within" should be (latitude, longitude, radius)');
      obj['$loc'] = {"$within": {"$center": [[parseFloat(value[0]), parseFloat(value[1])], parseInt(value[2])]}};
    } else if (field == '$fulltext') {
      if (operator != 'search') throw('sql error: "$fulltext" only support operator "search"'); 
      obj['$search'] = value;
    } else if (operator == 'is') {
      if (value != 'null' && value != 'notNull') throw('sql error: "is" is only for "null" or "not null"');
      obj[field] = {"$blank": (value == 'null' ? true : false)};
    } else {
      var filterOperator = _parseFilterOperator(operator);
      if (filterOperator == null) throw('sql error: unknow filter operator: '+operator);
      obj[field] = {};
      obj[field][filterOperator] = value;
    }

    return obj;
  },

  _parseFilterOperator: function (op) {
    switch (op) {
      case '<': return '$lt';
      case '<=': return '$lte';
      case '>': return '$gt';
      case '>=': return '$gte';
      case '=': return '$eq';
      case '<>': return '$neq';
      case '!=': return '$neq';
      case 'in': return '$in';
      case 'beginwith': return '$bw';
      default: return null;
    } 
  },

  _parseSort: function (statements) {
    var sort = {};
    var sortIdx = $.inArray('order', statements);
    if (sortIdx >= 0 && statements[sortIdx+1] == 'by') {
      sort.field = statements[sortIdx+2];
      var removeCount = 3;
      var dir = statements[sortIdx+3];
      if (dir == 'asc' || dir == 'desc') {
        sort.dir = dir;
        removeCount++;
      } else {
        sort.dir = 'asc';
      }
      statements.splice(sortIdx, removeCount);
    } else {
      return null;
    } 
    
    var sortParam = {};
    sortParam[sort.field] = sort.dir == 'asc' ? 1 : -1;
    return JSON.stringify([sortParam]);
  },

  _parseLimit: function (statements) {
    var limit = self.defaultLimit;
    var limitIdx = $.inArray('limit', statements);
    if (limitIdx >= 0 && /^\d+$/.test(statements[limitIdx+1])) {
      limit = parseInt(statements[limitIdx+1]);
      statements.splice(limitIdx, 2);
    }
    return limit;
  },

  _parseOffset: function (statements) {
    var offset = self.defaultOffset;
    var offsetIdx = $.inArray('offset', statements);
    if (offsetIdx >= 0 && /^\d+$/.test(statements[offsetIdx+1])) {
      offset = parseInt(statements[offsetIdx+1]);
      statements.splice(offsetIdx, 2);
    }
    return offset;
  }
});

Klass.create('Jsapi.Sql.SqlParser.FiltersNode', {
  parent: null,
  logic: 'and',
  add: function (node) {
    if (!self.children) self.children = [];
    self.children.push(node);
  }
});

Klass.create('Jsapi.Sql.SqlParser.FilterNode', {
  field: null,
  operator: null,
  value: null
});
