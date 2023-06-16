/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
	"sap/ui/model/json/JSONModel",
	"sap/ui/comp/filterbar/FilterBar",
	"sap/ui/comp/filterbar/FilterItem",
	"sap/ui/Device",
	"sap/m/SearchField",
	"sap/m/Input",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/base/ManagedObject",
	"sap/ui/comp/valuehelpdialog/ValueHelpRangeOperation",
	"./Mappings"
], function(ValueHelpDialog, JSONModel, FilterBar, FilterItem, Device, SearchField, Input, //eslint-disable-line max-params
			Filter, FilterOperator, ManagedObject, ValueHelpRangeOperation, Mappings) {
	"use strict";

	var mValueListTypes = Mappings.ValueListTypes;

	// EQ is omitted because the value help dialog 'Select From List' acts as EQ operator
	var INCLUDE_OPERATIONS = Object.freeze([
		ValueHelpRangeOperation.BT,
		ValueHelpRangeOperation.Contains,
		ValueHelpRangeOperation.EndsWith,
		ValueHelpRangeOperation.GE,
		ValueHelpRangeOperation.GT,
		ValueHelpRangeOperation.LE,
		ValueHelpRangeOperation.LT,
		ValueHelpRangeOperation.StartsWith
	]);

	return ManagedObject.extend("fin.ar.correspondence.create.v2.controller.utils.ValueHelpHandler", {
		/**
		 * @typedef {Object} ValueHelpParams
		 * @property {Object} model oData model used for value help requests
		 * @property {ParameterGroupSet[]} advancedParameters array of ParameterGroupSet with ParameterSet inside
		 * @property {boolean} supportMultiselect
		 * @property {boolean} supportRanges
		 * @property {boolean} supportRangesOnly
		 * @property {boolean} title
		 * @property {boolean} rangeKeyFields
		 * @property {boolean} label
		 * @property {boolean} tokens
		 * @property {Object[]} metadataParameters
		 * @property {string} metadataParametersOutputKey
		 * @property {Function} [ok]
		 * @property {Function} afterClose
		 */

		/**
		 * @param {ValueHelpParams} mParams parameters for ValueHelpHandler
		 */
		constructor: function(mParams) {
			this.oModel = mParams.model;
			this.aAdvancedParameters = mParams.advancedParameters;
			this.outputKey = mParams.metadataParametersOutputKey;
			this.mParams = mParams;

			this.oDialog = this._createValueHelp();
			this._initDialog(this.oDialog, mParams.metadataParameters);

			ManagedObject.apply(this, arguments);
		},

		handleValueHelp: function() {
			this.oDialog.open();
		},

		_initDialog: function(oDialog, aFields) {
			this._initColumns(oDialog, aFields);
			this._initFilterBar(oDialog, aFields);
		},

		_createValueHelp: function() {
			var that = this;

			var oDialog = new ValueHelpDialog({
				id: this.outputKey ? "valueHelpDialog-" + this.outputKey : undefined,
				supportMultiselect: this.mParams.supportMultiselect,
				supportRanges: this.mParams.supportRanges,
				supportRangesOnly: this.mParams.supportRangesOnly,
				title: this.mParams.title,
				tokenDisplayBehaviour: sap.ui.comp.smartfilterbar.DisplayBehaviour.descriptionOnly,
				cancel: function() {
					oDialog.close();
				},
				ok: function(oEvent) {
					if (that.mParams.ok) {
						that.mParams.ok(oEvent);
					}
					oDialog.close();
				},
				afterClose: function(){
					oDialog.destroy();

					if (that.mParams.afterClose) {
						that.mParams.afterClose(oDialog);
					}
				}
			});

			oDialog.setIncludeRangeOperations(INCLUDE_OPERATIONS);

			oDialog.setRangeKeyFields(this.mParams.rangeKeyFields);
			if (this.mParams.tokens) {
				oDialog.setTokens(this.mParams.tokens);
			}

			oDialog.getTable().setShowOverlay(true);

			return oDialog;
		},

		_onFilterBarFilterChange: function(oDialog) {
			oDialog.getTable().setShowOverlay(true);
		},

		_initFilterBar: function(oDialog, aFields) {
			var oFilterBar = new FilterBar(oDialog.getId() + "-filter-bar", {
				filterBarExpanded: Device.system.desktop,
				showFilterConfiguration: false,
				advancedMode: true,
				showGoOnFB: !Device.system.phone,
				header: this.mParams.label,
				filterItems: [],
				search: this._onFilterBarSearch.bind(this, oDialog),
				filterChange: this._onFilterBarFilterChange.bind(this, oDialog)
			});

			this.oBasicSearch = new SearchField(oDialog.getId() + "-search-field", {
				showSearchButton: true,
				search: oFilterBar.search.bind(oFilterBar)
			});

			if (oFilterBar.setBasicSearch) {
				oFilterBar.setBasicSearch(this.oBasicSearch);
			}

			// add filter items to filterBar
			for (var i = 0; i < aFields.length; i++) {
				var oField = aFields[i];
				if (!oField.isFilterable) {
					continue;
				}
				var oInput = new Input(oDialog.getId() + "-" + oField.valueListProperty + "-search-field");

				if (oField.Type === mValueListTypes.In || oField.Type === mValueListTypes.InOut) {
					oInput.setValue(this._getFilterValue(oField.valueListProperty));
				}

				oInput.attachSubmit(oFilterBar.search.bind(oFilterBar));
				oInput.attachChange(this._onFilterBarFilterChange.bind(this, oDialog));
				oFilterBar.addFilterItem(
					new FilterItem(oDialog.getId() + "-" + oField.valueListProperty + "-filter-item", {
							label: oField.label,
							name: oField.valueListProperty,
							control: oInput
						}
					)
				);
			}

			oDialog.setFilterBar(oFilterBar);
			return oFilterBar;
		},

		_getFilterValue: function(sId) {
			var sValue = "";

			outerloop:		// eslint-disable-line no-labels
				for (var i = 0; i < this.aAdvancedParameters.length; i++) {
					var aParams = this.aAdvancedParameters[i].ParameterSet;

					for (var j = 0; j < aParams.length; j++) {
						var oParam = aParams[j];

						if (oParam.Id === sId) {
							sValue = oParam.Value;
							break outerloop;	// eslint-disable-line no-labels
						}
					}
				}

			return sValue;
		},

		_onFilterBarSearch: function(oDialog, oControlEvent) {
			var oFilterBar = oDialog.getFilterBar();
			var aFilterItems = oFilterBar.getFilterItems();
			var aSelectionSet = oControlEvent.getParameters().selectionSet;
			// var aFilters = [];
			var mFilters = {};

			for (var i = 0; i < aFilterItems.length; i++) {
				var sVal = aSelectionSet[i].getValue();
				if (sVal) {
					mFilters[aFilterItems[i].getName()] = sVal;

				}
			}

			oDialog.getTable().setBusy(true);
			oDialog.getTable().setShowOverlay(false);

			this._getValueHelpResults(mFilters, oFilterBar.getBasicSearchValue())
				.then(
					this._setValueHelpValues.bind(this, oDialog),
					this._setValueHelpValues.bind(this, oDialog)
				);
		},

		_setValueHelpValues: function(oDialog, aData) {
			var aRows = (jQuery.isArray(aData) ? aData : []);
			var oTable = oDialog.getTable();
			var oRowsModel = new JSONModel(aRows);

			oTable.setBusy(false);

			oTable.setModel(oRowsModel);
			oTable.bindRows("/");
			oDialog.update();
		},


		_initColumns: function(oDialog, aFields) {
			var oColModel = new JSONModel();
			var aColumns = [];

			for (var i = 0; i < aFields.length; i++) {
				var oField = aFields[i];

				var oTemplate = {
					label: oField.label,
					template: oField.valueListProperty, // template is binding path to the value
					sort: oField.valueListProperty,
					sorted: false,
					tooltip: oField.label
				};

				// set the output value
				if (oField.type === mValueListTypes.Out || oField.type === mValueListTypes.InOut) {
					// description key is binding path to the value that is used as the text for the output token
					oDialog.setDescriptionKey(oField.valueListProperty);
					oDialog.setKey(oField.valueListProperty);
					oTemplate.sorted = true;
				}

				aColumns.push(oTemplate);
			}

			oColModel.setData({
				cols: aColumns
			});

			oDialog.getTable().setModel(oColModel, "columns");
		},

		/**
		 * Gets ValueHelp rows based on filters and search query
		 *
		 * @param {Object} [mFilters] name:value map of filters
		 * @param {string} [sSearch] oData $search query
		 * @return {[]} array of rows with results
		 * @private
		 */
		_getValueHelpResults: function(mFilters, sSearch) {
			var that = this;

			var aFilters = [];
			Object.keys(mFilters).forEach(function(sKey) {
				aFilters.push(new Filter({
					path: sKey,
					operator: FilterOperator.EQ,
					value1: mFilters[sKey]
				}));
			});


			return new Promise(function(resolve, reject) {
				that.oModel.read("/" + that.mParams.entitySet, {
					urlParameters: {
						search: (sSearch ? sSearch : "")
					},
					filters: aFilters,
					success: function(oData, oResponse) {
						var oResult = oData.results ? oData.results : oData;

						if (oResult.length) {
							resolve(oResult);
						} else {
							reject(oResult);
						}
					},
					error: reject
				});
			});
		},

		/**
		 * Validates that given value exists in value help results
		 *
		 * @param {string} sValue value for validation
		 * @param {boolean} [bValidateEmpty=false] specifies if empty value should be validated
		 * @return {boolean} true if value found in results, false otherwise
		 */
		validate: function(sValue, bValidateEmpty) {
			if (!bValidateEmpty && !sValue) {
				return Promise.resolve();
			}

			var mFilters = {};
			mFilters[this.outputKey] = sValue;

			return this._getValueHelpResults(mFilters);
		},
		
		destroy : function() {
			if (this.oDialog) {
				this.oDialog.destroy();
			}
			ManagedObject.prototype.destroy.apply(this, arguments);
		}
	});
});
