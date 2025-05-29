/*
 * @Author: zhanghan
 * @Date: 2023-11-01 12:51:23
 * @LastEditors: zhanghan 294333196@qq.com
 * @LastEditTime: 2023-11-10 15:16:08
 * @Descripttion: 动态数据字典处理
 */

import * as selectApiKeys from './selectApi';

const selectApi = async (
	type: string,
	labelName: string,
	valueName: string,
	allowEmpty: boolean,
	showMoreInfo: boolean,
	params: any
) => {
	const keyData: Record<string, any> = {};
	// 判断是否存在接口
	if ((selectApiKeys as any)[type]) {
		let list = [];
		// 获取接口字典数据
		list = await (selectApiKeys as any)[type](params);
		// 遍历接口数据，如果开启过滤且存在过滤条件labelName和valueName则过滤
		list.forEach((item: any, index: number) => {
			if (!showMoreInfo) {
				if (labelName && valueName) {
					allowEmpty || (item[labelName] && item[valueName])
						? (keyData[item[valueName]] = item[labelName])
						: null;
				} else if (labelName) {
					allowEmpty || item[labelName] ? (keyData[index] = item[labelName]) : null;
				} else if (typeof item === 'string') {
					keyData[index] = item;
				}
			} else {
				if (labelName && valueName) {
					allowEmpty || (item[labelName] && item[valueName])
						? (keyData[item[valueName]] = {
								...item,
								label: item[labelName],
								value: item[valueName],
						  })
						: null;
				} else if (labelName) {
					allowEmpty || item[labelName] ? (keyData[index] = {
						...item,
						label: item[labelName],
						value: index,
				  }) : null;
				} else if (typeof item === 'string') {
					keyData[index] = item;
				}
			}
		});
	}
	return keyData;
};

export default selectApi;
