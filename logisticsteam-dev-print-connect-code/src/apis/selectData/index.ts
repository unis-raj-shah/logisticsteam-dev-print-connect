/*
 * @Author: zhanghan
 * @Date: 2023-11-01 12:51:23
 * @LastEditors: zhanghan 294333196@qq.com
 * @LastEditTime: 2023-11-10 15:16:08
 * @Descripttion: 数据字典处理
 */

import selectStaticCode from './selectStaticCode';
import selectApi from './dynamic';

// 转换索引键值对
export function changeAryToObj(ary: any[]) {
	return Object.assign({}, ...ary.map((item, index) => ({ [index]: item })));
}

// 根据字典code返回对应名称
export function getNameByCode(type: string, code: string) {
	const data = selectStaticCode[type];
	if (data) {
		return data[code];
	} else {
		return code;
	}
}

/**
 * 根据value值查找数组的label标签
 * @param {array} ary 要查找的数组
 * @param {*} value 要查找的值
 */
export function getNameByList(ary: any = [], value: string | number) {
	if (!value) {
		return '';
	}
	if (ary.length === 0) {
		return '';
	}
	return (ary.find((item: any) => item.value === value) || {}).label || '';
}

// 获取对应的zo
export function getMap(type: string) {
	return selectStaticCode[type];
}

// 返回组件标准接口的option类型(格式：{ label: string, value: string | number })
interface optionsConfigType {
	openDynamic?: boolean;
	labelName?: string;
	valueName?: string;
	allowEmpty?: boolean;
	showMoreInfo?: boolean;
	params?: any;
}

// 获取字典（支持数组例如：['字典名称1'，'字典名称2'，'字典名称3']和键值对对象格式例如：{'字典值值1':'字典名称1'，'字典值值2':'字典名称2'，'字典值值2':'字典名称2'}）
export function getOptions(
	type: string,
	{
		openDynamic = false,
		labelName = '',
		valueName = '',
		allowEmpty = false,
		showMoreInfo = false,
		params = {},
	}: optionsConfigType = {}
): any {
	// 如果开启动态字典
	if (openDynamic) {
		// 使用 Promise 来处理异步操作
		return selectApi(type, labelName, valueName, allowEmpty, showMoreInfo, params).then(
			(codeMap) => {
				if (Array.isArray(codeMap)) codeMap = changeAryToObj(codeMap);
				return filterCodeMap(codeMap, showMoreInfo);
			}
		);
	} else {
		// 处理静态字典
		let codeMap = selectStaticCode[type];
		if (Array.isArray(codeMap)) codeMap = changeAryToObj(codeMap);
		return filterCodeMap(codeMap, showMoreInfo);
	}

	function filterCodeMap(codeMap: Record<string, any>, showMoreInfo: boolean) {
		return Object.keys(codeMap).map((key) => {
			const obj = showMoreInfo ? codeMap[key] : { label: codeMap[key], value: key };
			return obj;
		});
	}
}
