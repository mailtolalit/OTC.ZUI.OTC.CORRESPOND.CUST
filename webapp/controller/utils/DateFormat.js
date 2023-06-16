/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function () {
	"use strict";
	return {
		/**
		 * Converts a Date instance into an ABAP timestamp.
		 *
		 * @param {Date} oDate The date instance to convert
		 * @return {string} The output ABAP timestamp
		 * @public
		 */
		dateToAbapTimestamp: function (oDate) {
			if (oDate) {
				return "" + oDate.getFullYear() +
					(oDate.getMonth() < 9 ? "0" : "") + (oDate.getMonth() + 1) +
					(oDate.getDate() < 10 ? "0" : "") + oDate.getDate();
			}
			return "00000000";
		}
	};
});