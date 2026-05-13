/**
 * csv.js — 通用 CSV 解析与构建工具
 * 无业务依赖，纯字符串处理
 * 支持：UTF-8 BOM、CRLF/LF、引号包裹、字段内逗号/换行、双引号转义
 */

/**
 * 解析 CSV 文本为对象数组
 * @param {string} text - CSV 文本
 * @returns {Array<Object>} 每行为一个对象，key 为表头中文名
 */
function parseCSV(text) {
  if (!text) return [];
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var lines = _splitRespectingQuotes(text);
  if (lines.length < 2) return [];
  var headers = _parseLine(lines[0]);
  var result = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i];
    if (!line.trim()) continue;
    var values = _parseLine(line);
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] !== undefined ? values[j] : '';
    }
    result.push(obj);
  }
  return result;
}

/**
 * 将对象数组构建为 CSV 文本（不含 BOM）
 * @param {Array<string>} headers - 列名数组，决定列顺序
 * @param {Array<Object>} rows - 数据行数组
 * @returns {string} CSV 文本
 */
function buildCSV(headers, rows) {
  var lines = [headers.map(escapeCSV).join(',')];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var fields = [];
    for (var j = 0; j < headers.length; j++) {
      fields.push(escapeCSV(row[headers[j]]));
    }
    lines.push(fields.join(','));
  }
  return lines.join('\n');
}

/**
 * 转义单个 CSV 字段值
 * @param {*} val
 * @returns {string}
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  var str = String(val);
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function _splitRespectingQuotes(text) {
  var lines = [];
  var buf = '';
  var inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        buf += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        buf += ch;
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) lines.push(buf);
  return lines;
}

function _parseLine(line) {
  var result = [];
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

module.exports = {
  parseCSV: parseCSV,
  buildCSV: buildCSV,
  escapeCSV: escapeCSV
};
