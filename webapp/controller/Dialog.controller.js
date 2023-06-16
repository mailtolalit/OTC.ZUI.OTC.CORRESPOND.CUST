/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"otc/ar/correspondence/create/v2/controller/BaseController",
	"sap/ui/core/ValueState",
	"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
	"sap/ui/comp/filterbar/FilterBar",
	"sap/ui/comp/filterbar/FilterItem",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter",
	"sap/m/Input",
	"sap/m/SearchField",
	"sap/m/Label",
	"sap/ui/model/json/JSONModel",
	"sap/m/ColumnListItem",
	"sap/ui/Device",
	"sap/m/Token",
	"sap/m/MessageToast",
	"./utils/Mappings"
], function(BaseController, ValueState, ValueHelpDialog, FilterBar, FilterItem, Filter, //eslint-disable-line max-params
			FilterOperator, Sorter, Input, SearchField, Label, JSONModel, ColumnListItem, Device, Token, MessageToast, Mappings) {
	"use strict";

	var mCorrItemsProperties = Mappings.CorrItemsProperties;
	var mDialogProperties = Mappings.DialogProperties;
	var mEntitySets = Mappings.EntitySets;
	var mModelNames = Mappings.ModelNames;
	var mPropertyTypes = Mappings.ModelPropertyTypes;


	return BaseController.extend("otc.ar.correspondence.create.v2.controller.Dialog", {
		initDialog: function(oOptions) {
			var that = this;

			this._oDialog = oOptions.dialog;
			this._oModel = oOptions.model;
			this._oController = oOptions.controller;

			if (this._oDialog.attachBeforeOpen) {
				this._oDialog.attachBeforeOpen(function() {
					that._oDialog.setBusy(false);
				});
			}
		},

		/**
		 * Resets value and valueState for all given sap.m.Input fields.
		 */
		resetFields: function() {
			for (var i = 0; i < arguments.length; i++) {
				var oField = arguments[i];

				oField.setValueState(ValueState.None);
				oField.setValue("");
			}
		},

		/**
		 * Trim all sap.m.Input fields.
		 */
		trimFields: function() {
			for (var i = 0; i < arguments.length; i++) {
				var oField = arguments[i];

				oField.setValue(oField.getValue().trim());
			}
		},

		/**
		 * Validates that given sap.m.Input fields are not empty and sets stateValue accordingly
		 *
		 * @returns {boolean} True if all fields valid, otherwise false
		 */
		validateRequiredFields: function() {
			var aFields = arguments,
				bIsValid = true,
				oField,
				sValue;

			for (var i = 0; i < aFields.length; i++) {
				oField = aFields[i];
				sValue = oField.getValue();

				if (!sValue || sValue === "") {
					oField.setValueStateText(this._oController.translateText("INPUT_REQUIRED_ERROR"));
					oField.setValueState(ValueState.Error);
					bIsValid = false;
				} else {
					oField.setValueState(ValueState.None);
				}
			}

			return bIsValid;
		},

		sendSingleRequest: function(oData, sSuccessTextName) {
			var that = this;

			that._oDialog.setBusy(true);

			return this._sendRequest(oData).then(function() {
				var sMsg = that._oController.translateText(sSuccessTextName);
				that._oDialog.close();
				MessageToast.show(sMsg);
			}, function(oError) {
				that._oDialog.setBusy(false);
				try {
					var oErrorData = jQuery.parseJSON(oError.responseText);

					if (oErrorData && oErrorData.error) {
						var sCode = oErrorData.error.code;
						var oErrorHandler = that._oController.getOwnerComponent().getErrorHandler();

						that._oController.processCustomErrorStates({
							isCustomer: oErrorHandler.isCustomerError(sCode),
							isVendor: oErrorHandler.isVendorError(sCode)
						});
					}
				} catch (e) {
					// no relevant problem occurred, error just doesn't contain customer or vendor error code
					jQuery.sap.log.warning("Error doesn't contain customer or vendor error code");
				}
			});
		},

		/** Promise object wrapped with status to prevent Promise.all from failing
		 * @typedef {Promise} SafePromise
		 * @property {string} status resolved/rejected
		 * @property {object} response
		 */

		/**
		 * Wraps and annotates promise with resolved/reject status
		 * Useful when you want Promise.all to resolve even when some of the promises inside fails
		 *
		 * @param {Promise} oPromise promise object
		 * @return {SafePromise} with status:resolved/rejected and response
		 */
		reflect: function(oPromise) {
			return oPromise.then(
				function(oResponse) {
					return {status: "resolved", response: oResponse};
				},
				function(oError) {
					return {status: "rejected", response: oError};
				}
			);
		},

		/**
		 * Sends multiple emails as batch
		 *
		 * @param {object []} aData parameters for email request
		 * @param {object []} aCorrItems correspondence items
		 * @param {string} sSuccessText message to be showed in message toast if the request is successful
		 * @param {string} sExternalAction name of the action of the mass request (print, email)
		 * @returns {Promise} mass request promise
		 */
		sendMassRequest: function(aData, aCorrItems, sSuccessText, sExternalAction) {
			var that = this;
			var aPromises = [];

			aData.forEach(function(oRequestData) {
				aPromises.push(
					that.reflect(this._sendRequest(oRequestData))
				);
			}, this);

			return Promise.all(aPromises).then(function(aResponseData) {
				var aResults = [];

				aResponseData.forEach(function(oResponseData, iIndex) {
					if (oResponseData.status === "resolved") {
						var oContext = aCorrItems[iIndex].getBindingContext(mModelNames.CorrItems);

						aResults.push({
							ApplicationObjectId: oResponseData.response.ApplicationObjectId,
							Id: oContext.getProperty(mPropertyTypes.Id)
						});
					}
				});

				MessageToast.show(that._oController.translateText(sSuccessText));
				that._oController._checkNavigation(sExternalAction, aResults);

				return aResponseData;
			});
		},

		_setCorrStatus: function(aCorrItems, aResponseData, sType) {
			aResponseData.forEach(function(oResponseData, iIndex) {
				if (oResponseData.status === "resolved") {
					var oContext = aCorrItems[iIndex].getBindingContext(mModelNames.CorrItems);

					this._oController._setCorrespondenceStatus(sType, true, oContext);
				}
			}, this);
		},

		/**
		 * Sends request from dialog to server
		 *
		 * @param {object} oData Request parameters
		 * @returns {Promise} send request promise
		 */
		_sendRequest: function(oData) {
			var that = this;
			return new Promise(function(fnResolve, fnReject) {
				that._oModel.create("/" + mEntitySets.CorrOutputSet, oData, {
					success: function(oResponseData, oResponse) {
						fnResolve(oResponseData);
					},
					error: function(oError) {
						fnReject(oError);
					}
				});
			});
		},

		/**
		 * Sets text for situation, when the table doesn't contain any items"
		 *
		 * @param {object} oTable sap.ui.table.Table or sap.m.Table
		 * @param {string} sText Text to show in table in case when the table doesn't contain any items
		 *
		 * @private
		 */
		_setNoData: function(oTable, sText) {
			if (oTable instanceof sap.ui.table.Table) {
				oTable.setNoData(this._oController.translateText(sText));
			} else {
				oTable.setNoDataText(this._oController.translateText(sText));
			}
		},


		/**
		 * Checks if given text is already used as text in some token from givne sap.m.MultiInput field
		 *
		 * @param {string} sText text
		 * @param {sap.m.Token[]} aTokens tokens
		 *
		 * @returns {boolean} true if sText is already used in some token, false otherwise
		 */
		isInTokens: function(sText, aTokens) {
			var bIs = false;

			aTokens.forEach(
				function(oToken) {
					if (oToken.getText() === sText) {
						bIs = true;
					}
				}
			);
			return bIs;
		},

		/**
		 * Initializes ValueHelpDialog
		 *
		 * @param {object} mParams Parameters for ValueHelpDialog
		 * @param {string} mParams.sEntitySet Name of entity set
		 * @param {string} mParams.sEntityType Name of entity type
		 * @param {string[]} mParams.aFilterFields Data filters
		 * @param {string[]} mParams.aColumnFields Names for table columns
		 * @param {string} mParams.sMainKey Name of column that is returned from value helper
		 * @param {object} mParams.oResultField Field for showing the returned value
		 * @param {object} mODataProperties Properties taken from OData
		 * @param {object} oColModel Model for table columns
		 *
		 * @returns {object} Newly created ValueHelpDialog
		 *
		 * @private
		 */
		_initValueHelpDialog: function(mParams, mODataProperties, oColModel) {
			var that = this,
				oTable,
				oValueHelpDialog,
				oToken,
				iIndex,
				sText;

			this._onBatchRequestSend = function() {
				if (oTable.getShowOverlay()) {
					oTable.setShowOverlay(false);
				}
				that._setNoData(oTable, "SEARCHING");
				oTable.setBusy(true);
			};

			this._onBatchRequestCompleted = function() {
				that._setNoData(oTable, "NO_ITEMS_FOUND");
				oTable.setBusy(false);
			};

			oValueHelpDialog = new ValueHelpDialog({
				title: mODataProperties[mParams.sMainKey]["sap:label"],
				supportMultiselect: mParams.bSupportMultiselect,
				supportRanges: false,
				supportRangesOnly: false,
				descriptionKey: mParams.sMainKey,
				stretch: Device.system.phone,

				ok: function(oControlEvent) {
					var oModel,
						oRes,
						oProperty;

					if (mParams.oBinding) {
						oModel = mParams.oBinding.sModel ? that._oDialog.getModel(mParams.oBinding.sModel) : that._oDialog.getModel();

					}

					if (mParams.bSupportMultiselect) {
						if (oTable instanceof sap.ui.table.Table) { //on desktop+tablets is used sap.ui.table.Table
							oControlEvent.getParameter("tokens").forEach(function(oTok) {
								if (!that.isInTokens(oTok.getText(), mParams.oResultField.getTokens())) {
									if (mParams.oBinding) {
										oRes = {};
										oRes[mParams.oBinding.sResultProperty] = oTok.getText();

										oModel.getProperty(mParams.oBinding.sProperty).push(oRes);
										oModel.refresh(true);
									} else {
										// mParams.oResultField.setTokens(oControlEvent.getParameter("tokens"));
										mParams.oResultField.addToken(oTok);
									}
								}
							});

							// remove tokens from result field, that user unselected in value helper
							var aRemovalTokens = [];
							mParams.oResultField.getTokens().forEach(function(oTok) {
								if (!that.isInTokens(oTok.getText(), oControlEvent.getParameter("tokens"))) {
									aRemovalTokens.push(oTok);
								}
							});

							aRemovalTokens.forEach(function(oTok) {
								if (mParams.oBinding) {
									oProperty = oModel.getProperty(mParams.oBinding.sProperty);
									oProperty.splice(oProperty.indexOf(oProperty.find(function(oObject) {
										return oObject[mParams.oBinding.sResultProperty] === oTok.getKey();
									})), 1);
									oModel.refresh(true);
								} else {
									mParams.oResultField.removeToken(oTok);
								}
							});


						} else { //getParameter("tokens") returns only 1 value even with more values selected on mobile
							// find which column is the key one
							this.getTable().getColumns().forEach(function(oColumn, iIdx) {
								if (oColumn.getHeader().getText() === mODataProperties[mParams.sMainKey]["sap:label"]) {
									iIndex = iIdx;
								}
							});
							// tokenize values from the key column for each selected row
							this.getTable().getSelectedItems().forEach(function(oItem) {
								sText = oItem.getCells()[iIndex].getText();

								if (!that.isInTokens(sText, mParams.oResultField.getTokens())) {
									mParams.oResultField.addToken(
										new Token({
											key: sText,
											text: sText
										})
									);
								}
							});
						}

					} else {
						oToken = oControlEvent.getParameter("tokens")[0];

						if (that._dialogCustomOk) {
							that._dialogCustomOk(oToken);
						}

						mParams.oResultField.setValue(oToken.getText());
						mParams.oResultField.fireChange();
					}

					oValueHelpDialog.close();
				},

				cancel: function(oControlEvent) {
					oValueHelpDialog.close();
				},

				afterOpen: function() {
					// attach only for duration of this helper (it would get triggered from every other batch req)
					that._oModel.attachBatchRequestSent(that._onBatchRequestSend, this);
					that._oModel.attachBatchRequestCompleted(that._onBatchRequestCompleted, this);
					if (mParams.bShowGoButton === false) {
						this.getFilterBar().search();
					}
				},

				afterClose: function() {
					that._oModel.detachBatchRequestSent(that._onBatchRequestSend, this);
					that._oModel.detachBatchRequestCompleted(that._onBatchRequestCompleted, this);
					oValueHelpDialog.destroy();
					if (mParams && mParams.oInput) {
						mParams.oInput.fireTokenUpdate();
					}
				}

			});

			if (mParams.bSupportMultiselect) {
				oValueHelpDialog.setTokens(mParams.oResultField.getTokens());
			}

			oTable = oValueHelpDialog.getTable();
			oTable.setModel(oColModel, "columns");
			oTable.setModel(this._oModel);
			oTable.setShowOverlay(true);

			jQuery.sap.syncStyleClass("sapUiSizeCompact", this._oController.getView(), oValueHelpDialog);
			jQuery.sap.syncStyleClass("sapUiSizeCozy", this._oController.getView(), oValueHelpDialog);

			return oValueHelpDialog;
		},

		_onFilterBarSearch: function(oControlEvent, mParams, oValueHelpDialog) {
			var aFilters = [],
				oFilter,
				oTable,
				sVal,
				oSorter,
				i,
				aCols;

			oTable = oValueHelpDialog.getTable();

			for (i = 0; i < mParams.aFilterFields.length; i++) {
				sVal = oControlEvent.getParameters().selectionSet[i].getValue();
				if (sVal) {
					oFilter = new Filter(mParams.aFilterFields[i], FilterOperator.EQ, sVal);
					aFilters.push(oFilter);
				}
			}

			//reason for this whole ValueHelpDialog - BusinessPartner filter
			oFilter = new Filter(
				{
					filters: [
						new Filter({
							path: mDialogProperties.BusinessPartner,
							operator: FilterOperator.EQ,
							value1: this._getEmailProperty(mCorrItemsProperties.BusinessPartner)
						}),
						new Filter({
							filters: [
								new Filter({
									path: mDialogProperties.CompanyCode, 
									operator: FilterOperator.EQ, 
									value1: ""
								}),
								new Filter({
									filters: [
										new Filter({
											path: mDialogProperties.CompanyCode, 
											operator: FilterOperator.EQ, 
											value1: this._getEmailProperty(mCorrItemsProperties.CompanyCode)
										}),
										new Filter({
											path: mDialogProperties.CorrespondenceEmailSourceType, 
											operator: FilterOperator.EQ, 
											value1: this._getEmailProperty(mCorrItemsProperties.ClerkSourceType)
										})
									],
									and: true
								})
							],
							and: false
						})
					],
					and: true
				}
			);
			aFilters.push(oFilter);

			oFilter = new Filter({
				filters: aFilters,
				and: true
			});

			aFilters = [oFilter];

			oSorter = new Sorter(mParams.sMainKey, false, false);


			var mBindingParams = {
				path: "/" + mParams.sEntitySet,
				filters: aFilters,
				sorter: oSorter,

				parameters: {
					select: mParams.aColumnFields.join()
				}
			};
			
			if (this.oBasicSearch) {
				mBindingParams.parameters.custom = {
					search: this.oBasicSearch.getValue()
				};
			}

			if (oTable instanceof sap.ui.table.Table) { //on desktop+tablets is used sap.ui.table.Table
				oTable.bindRows(mBindingParams);

			} else { //on mobile is used sap.m.Table
				mBindingParams.factory = function(sId, oContext) {
					aCols = oTable.getModel("columns").getData().cols;

					return new ColumnListItem({
						cells: aCols.map(function(column) {
							var colname = column.template;
							return new Label({text: "{" + colname + "}"});
						})
					});
				};
				oTable.bindItems(mBindingParams);
			}

			oValueHelpDialog.update();
		},


		/**
		 * Sets on tables overlay and changes no data text
		 *
		 * @param {sap.ui.table.Table|sap.m.Table} oTable table
		 *
		 * @private
		 */
		onFilterBarFilterChange: function(oTable) {
			if (oTable) {
				oTable.setShowOverlay(true);
				this._setNoData(oTable, "USE_SEARCH");
			}
		},

		/**
		 * Initializes FilterBar
		 *
		 * @param {object} mParams Parameters for ValueHelpDialog
		 * @param {string} mParams.sEntitySet Name of entity set
		 * @param {string} mParams.sEntityType Name of entity type
		 * @param {string[]} mParams.aFilterFields Data filters
		 * @param {string[]} mParams.aColumnFields Names for table columns
		 * @param {string} mParams.sMainKey Name of column that is returned from value helper
		 * @param {object} mParams.oResultField Field for showing the returned value
		 * @param {object} mODataProperties Properties taken from OData
		 * @param {object} oValueHelpDialog ValueHelpDialog object

		 * @returns {object} Newly created FilterBar
		 *
		 * @private
		 */
		_initFilterBar: function(mParams, mODataProperties, oValueHelpDialog) {
			var that = this,
				oFilterBar,
				i,
				oControl,
				fnOnChange;

			oFilterBar = new FilterBar({
				filterBarExpanded: Device.system.desktop,
				showFilterConfiguration: false,
				advancedMode: true,
				showGoOnFB: mParams.bShowGoButton !== false ? !Device.system.phone : false,
				header: mParams.oEntitySet["sap:label"],
				filterItems: [],
				search: function(oControlEvent) {
					that._onFilterBarSearch(oControlEvent, mParams, oValueHelpDialog);
				},
				filterChange: function(oControlEvent) {
					that.onFilterBarFilterChange(oValueHelpDialog.getTable());
				}
			});

			if (!mParams.bDoNotGenerateBasicSearch) {
				this.oBasicSearch = new SearchField({
					showSearchButton: true,
					search: function() {
						oValueHelpDialog.getFilterBar().search();
					}
				});
	
				if (oFilterBar.setBasicSearch) {
					oFilterBar.setBasicSearch(this.oBasicSearch);
				}
			}
			
			fnOnChange = function() {
				that.onFilterBarFilterChange(oValueHelpDialog.getTable());
			};

			// add filter items to filterBar
			for (i = 0; i < mParams.aFilterFields.length; i++) {
				mODataProperties[mParams.aFilterFields[i]] = mParams.oMetaModel.getODataProperty(mParams.oEntityType, mParams.aFilterFields[i]);
				oControl = new Input();
				oControl.attachSubmit(oFilterBar.search.bind(oFilterBar));
				oControl.attachChange(fnOnChange);
				oFilterBar.addFilterItem(
					new FilterItem(
						{
							label: mODataProperties[mParams.aFilterFields[i]]["sap:label"],
							name: mODataProperties[mParams.aFilterFields[i]]["name"],
							control: oControl
						}
					)
				);
			}
			return oFilterBar;
		},

		onValueHelpRequest: function(mParams) {
			var oColModel = new JSONModel();
			var aCols = [];
			var mODataProperties = {};

			mParams.oMetaModel = this._oModel.getMetaModel();
			mParams.oEntityType = mParams.oMetaModel.getODataEntityType(mParams.sEntityType);
			mParams.oEntitySet = mParams.oMetaModel.getODataEntitySet(mParams.sEntitySet);


			if (!mParams.aColumnFields) {
				mParams.aColumnFields = mParams.aFilterFields;
			}

			// get data about columns and filters from metadata
			for (var i = 0; i < mParams.aColumnFields.length; i++) {
				mODataProperties[mParams.aColumnFields[i]] = mParams.oMetaModel.getODataProperty(mParams.oEntityType, mParams.aColumnFields[i]);

				aCols.push(
					{label: mODataProperties[mParams.aColumnFields[i]]["sap:label"], template: mParams.aColumnFields[i]}
				);
			}

			// model that describes columns of the ValueHelpDialog table
			oColModel.setData({
				cols: aCols
			});

			var oValueHelpDialog = this._initValueHelpDialog(mParams, mODataProperties, oColModel);
			var oFilterBar = this._initFilterBar(mParams, mODataProperties, oValueHelpDialog);

			oValueHelpDialog.setFilterBar(oFilterBar);
			oValueHelpDialog.open();
		},

		closeDialog: function() {
			this._oDialog.close();
		}
	});
});