/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"./Mappings",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/TextArea",
	"sap/m/InputType",
	"sap/m/Select",
	"sap/ui/core/ListItem",
	"sap/m/MultiInput",
	"sap/m/RadioButton",
	"sap/m/CheckBox",
	"sap/m/DatePicker",
	"sap/ui/core/ValueState",
	"sap/ui/core/Title",
	"sap/m/FlexBox",
	"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
	"sap/ui/comp/valuehelpdialog/ValueHelpRangeOperation",
	"sap/m/Token",
	"sap/ui/layout/GridData",
	"sap/ui/base/Event",
	"./ValueHelpHandler",
	"sap/ui/model/type/Integer",
	"sap/ui/core/CustomData"
], function(Mappings, Label, Input, TextArea, InputType, Select, ListItem, MultiInput, RadioButton, CheckBox, DatePicker, // eslint-disable-line max-params
			ValueState, Title, FlexBox, ValueHelpDialog, ValueHelpRangeOperation, Token, GridData, Event, ValueHelpHandler, IntegerType, CustomData) {
	"use strict";

	var mAdvancedParameterEvents = Mappings.AdvancedParameterEvents;
	var mAdvancedParameterTypes = Mappings.AdvancedParameterTypes;
	var mComplexTypes = Mappings.ComplexTypes;
	var mCorrItemsProperties = Mappings.CorrItemsProperties;
	var mModelNames = Mappings.ModelNames;
	var mModelPropertyTypes = Mappings.ModelPropertyTypes;
	var mRangeSigns = Mappings.RangeSigns;
	var mServices = Mappings.Services;
	var mValueListTypes = Mappings.ValueListTypes;

	var CONTROL_SPAN = "XL12 L12 M7 S12";
	var LABEL_SPAN = "XL12 L12 M12 S12";

	return {
		parseAdvancedParameters: function(oAdvParamDef) {
			if (!jQuery.isArray(oAdvParamDef.ParametersGroupSet.results)) {
				return [];
			}

			return this.getParameterGroups(oAdvParamDef);
		},

		getParameterGroups: function(oAdvancedParameters) {
			var aGroups = oAdvancedParameters.ParametersGroupSet.results;
			var mHashedGroups = {};
			var mHasMandatory = false;
			var fnSort = function(oGroup1, oGroup2) {
				return oGroup1.Position - oGroup2.Position;
			};

			aGroups.sort(fnSort);

			aGroups.forEach(function(oGroup) {
				oGroup.ParameterSet = [];
				mHashedGroups[oGroup.Id] = oGroup;
			});

			oAdvancedParameters.ParameterSet.results.forEach(function(oParam) {
				if (oParam.IsMandatory) {
					mHasMandatory = true;
				}
				mHashedGroups[oParam.ParametersGroupId].ParameterSet.push(oParam);
				// load default value (into model)
				oParam.Value = (oParam.IsRange) ? JSON.parse(oParam.RawValue) : oParam.RawValue;
			});

			aGroups.forEach(function(oGroup) {
				oGroup.ParameterSet.sort(fnSort);
			});

			return {'Groups': aGroups, 'HasMandatory': mHasMandatory};
		},

		/**
		 * Creates and returns controls based on parameters of selected CorrType
		 *
		 * @param {Array} aGroups advanced parameters of the currently selected correspondence type object
		 * @param {function} fnOnAdvancedParameterChange onChange handler
		 * @param {Object} oModel OData model
		 * @return {Array} aControls simple form content
		 */
		getControls: function(aGroups, fnOnAdvancedParameterChange, oModel) {
			var aControls = [];

			aGroups.forEach(function(oGroup, iIndex) {
				aControls = aControls.concat(this._createGroupControls(oGroup, iIndex, fnOnAdvancedParameterChange, oModel));
			}, this);

			return aControls;
		},

		/**
		 * @typedef {Object} ValueHelpParameter
		 * @param {string} localProperty
		 * @param {string} type
		 * @param {string} valueListProperty
		 * @param {string} label
		 */

		/**
		 * @typedef {Object} ValueHelpMetadata
		 * @param {string} name
		 * @param {string} entitySet
		 * @param {string} label
		 * @param {ValueHelpParameter[]} parameters
		 * @param {boolean} isFixedValuesValueList
		 * @param {string} outputKey
		 * @param {string} outputKeyTextPath
		 */

		/**
		 *
		 * @param {sap.ui.model.odata.v2.ODataModel} oModel OData model
		 * @param {string} sId id of the property
		 * @returns {ValueHelpMetadata} parsed metadata for value helper
		 */
		parseMetadata: function(oModel, sId) {
			try {
				var sPath = mServices.Correspondence + "." + mComplexTypes.AdvancedParameters;
				var oMetaModel = oModel.getMetaModel();
				var oComplexType = oMetaModel.getODataComplexType(sPath);
				var sOutputKey = "";
				var sOutputKeyTextPath;

				return oComplexType.property
					.filter(function(oProperty) {
						return oProperty.name.toUpperCase() === sId.toUpperCase();
					}, this)
					.map(function(oProperty) {
						var oValueList = oProperty["com.sap.vocabularies.Common.v1.ValueList"];

						var sEntitySet = oValueList.CollectionPath.String;
						var aParameters = oValueList.Parameters.map(function(oParameter) {
							var sValueListProperty = oParameter.ValueListProperty.String;
							var oParsedParameter = {
								localProperty: null,
								type: oParameter.RecordType,
								valueListProperty: sValueListProperty,
								label: this._getLabelForValueListProperty(oMetaModel, sEntitySet, sValueListProperty),
								isFilterable: this._getIsFilterableForValueListProperty(oMetaModel, sEntitySet, sValueListProperty)
							};

							if (oParameter.RecordType !== mValueListTypes.DisplayOnly) {
								oParsedParameter.localProperty = oParameter.LocalDataProperty.PropertyPath;
							}

							if (oParameter.RecordType === mValueListTypes.Out || oParameter.RecordType === mValueListTypes.InOut) {
								sOutputKey = sValueListProperty;
								sOutputKeyTextPath = this._getPathToTextForValueListProperty(oMetaModel, sEntitySet, sValueListProperty);
							}

							return oParsedParameter;
						}, this);

						var sLabel = oValueList.Label.String;
						return {
							name: oProperty.name.toUpperCase(),
							entitySet: sEntitySet,
							label: sLabel,
							parameters: aParameters,
							isFixedValuesValueList: oProperty["sap:value-list"] === "fixed-values",
							outputKey: sOutputKey,
							outputKeyTextPath: sOutputKeyTextPath
						};
					}, this).pop();
			} catch (e) {
				jQuery.sap.log.error("webapp/controller/utils/AdvancedParameter.js - failed to parse Metadata");
				return null;
			}
		},

		_getValueListProperty: function(oMetaModel, sEntitySet, sValueListProperty) {
			var sEntityType = oMetaModel.getODataEntitySet(sEntitySet).entityType;
			var oEntityType = oMetaModel.getODataEntityType(sEntityType);

			return oEntityType.property.filter(function(oProperty) {
				return oProperty.name === sValueListProperty;
			}).pop();
		},

		_getLabelForValueListProperty: function(oMetaModel, sEntitySet, sValueListProperty) {
			var oProperty = this._getValueListProperty(oMetaModel, sEntitySet, sValueListProperty);
			return oProperty["sap:label"] || oProperty["com.sap.vocabularies.Common.v1.Label"].String;
		},

		_getIsFilterableForValueListProperty: function(oMetaModel, sEntitySet, sValueListProperty) {
			var oProperty = this._getValueListProperty(oMetaModel, sEntitySet, sValueListProperty);
			var sIsFilterable = oProperty["sap:filterable"] || "true";
			return sIsFilterable === "true";
		},

		_getPathToTextForValueListProperty: function(oMetaModel, sEntitySet, sValueListProperty) {
			var oProperty = this._getValueListProperty(oMetaModel, sEntitySet, sValueListProperty);
			var oTextProperty = oProperty["com.sap.vocabularies.Common.v1.Text"];
			return oProperty["sap:text"] || (oTextProperty && oTextProperty.Path);
		},

		_createGroupControls: function(oGroup, iGroupIndex, fnOnAdvancedParameterChange, oModel) {
			var aControls = [];
			var aParams = oGroup.ParameterSet;

			aParams.forEach(function(oParam, iIndex) {
				aControls = aControls.concat(this._createInputControl(oParam, iGroupIndex, iIndex, fnOnAdvancedParameterChange, oModel));
			}, this);

			if (oGroup.InLine) {
				aControls = [
					new FlexBox({
						id: "flexBox-" + oGroup.Id,
						items: aControls,
						layoutData: [
							new GridData({
								id: "flexboxGridData-" + oGroup.Id,
								span: CONTROL_SPAN
							})
						]
					})
				];
			}

			if (oGroup.Caption) {
				aControls = [
					new Title({
						id: "title-" + oGroup.Id,
						text: oGroup.Caption
					})
				].concat(
					aControls
				);
			}

			return aControls;
		},

		/**
		 * @typedef {Object} AdvancedParameter
		 * @property {string} Event
		 * @property {string} VariantId
		 * @property {string} CorrespondenceTypeId
		 * @property {string} ParametersGroupId
		 * @property {string} Id
		 * @property {string} Caption
		 * @property {string} Position
		 * @property {string} NoLabel
		 * @property {string} RadioGroup
		 * @property {string} IsMandatory
		 * @property {string} IsHidden
		 * @property {string} IsReadOnly
		 * @property {string} Type
		 * @property {string} IsRange
		 * @property {string} RawValue
		 * @property {string} MinValue
		 * @property {string} MaxValue
		 */

		/**
		 * Returns control based on the parameters
		 * @param {AdvancedParameter} oParam description of the control from OData call
		 * @param {number} iGroupIndex index of the group
		 * @param {number} iParameterIndex index of the parameter
		 * @param {Function} fnOnAdvancedParameterChange callback that should be called when advanced parameter change
		 * @param {sap.ui.model.odata.v2.ODataModel} oModel main OData model
		 * @returns {sap.ui.core.Control[]} array of control that will be rendered based on the description
		 * @private
		 */
		_createInputControl: function(oParam, iGroupIndex, iParameterIndex, fnOnAdvancedParameterChange, oModel) {
			var aControls = [];

			var oValueHelpMetadata = this.parseMetadata(oModel, oParam.Id);

			// don't show hidden, value is already loaded in model in parseAdvancedParameters
			if (oParam.IsHidden) {
				return aControls;
			}

			if (!oParam.NoLabel && oParam.Type !== mAdvancedParameterTypes.Boolean) {
				aControls.push(this._getLabelControl(oParam));
			}

			var oControl;
			var oBindingPaths = this._getControlBindingPaths(iGroupIndex, iParameterIndex);

			switch (oParam.Type) {
				case mAdvancedParameterTypes.String:
				case mAdvancedParameterTypes.Number:
					oControl = this._getInputControl(oParam, oValueHelpMetadata, oBindingPaths, fnOnAdvancedParameterChange);
					break;

				case mAdvancedParameterTypes.Boolean:
					oControl = this._getBooleanControl(oParam, oBindingPaths, fnOnAdvancedParameterChange);
					break;

				case mAdvancedParameterTypes.Date:
					oControl = this._getDateControl(oParam, oBindingPaths, fnOnAdvancedParameterChange);
					break;

				default:
					jQuery.sap.log.error("Unknown advanced parameter type in ValueHelpHandler.js");
					break;
			}

			if (oControl) {
				oControl.setLayoutData(new GridData({
					id: "controlGridData-" + oParam.Id,
					span: CONTROL_SPAN
				}));

				aControls.push(oControl);
			}

			return aControls;
		},

		/**
		 * Get binding paths for control.
		 * @param {number} iGroupIndex group index
		 * @param {number} iParameterIndex parameter index
		 * @returns {{Value: string, ValueState: string}} Info object about binding paths
		 * @private
		 */
		_getControlBindingPaths: function(iGroupIndex, iParameterIndex) {
			var sPath = mModelNames.CorrItems + ">" +
				mModelPropertyTypes.SelectedCorrespondence + "/" +
				mCorrItemsProperties.AdvancedParameters + "/" +
				iGroupIndex + "/" +
				mCorrItemsProperties.ParameterSet + "/" +
				iParameterIndex + "/";

			return {
				Value: sPath + mCorrItemsProperties.Value,
				ValueState: sPath + mCorrItemsProperties.ValueState,
				ValueStateText: sPath + mCorrItemsProperties.ValueStateText
			};
		},

		_getLabelControl: function(oParam) {
			return new Label({
				id: "label-" + oParam.Id,
				text: oParam.Caption,
				required: oParam.IsMandatory,
				labelFor: oParam.Id,
				layoutData: [
					new GridData({
						id: "labelGridData-" + oParam.Id,
						span: LABEL_SPAN
					})
				]
			});
		},

		_canUseSelectInput: function (oValueHelpMetadata, bValueHelpMetadataDefined) {
			return bValueHelpMetadataDefined
				&& oValueHelpMetadata.isFixedValuesValueList
				&& (oValueHelpMetadata.parameters.length === 1
					|| (oValueHelpMetadata.parameters.length === 2
						&& oValueHelpMetadata.outputKeyTextPath));
		},

		_getInputControl: function (oParam, oValueHelpMetadata, oBindingPaths, fnOnAdvancedParameterChange) {
			var bValueHelpMetadataDefined = Boolean(oValueHelpMetadata);
			var oControl;

			if (oParam.IsRange) {
				oControl = this._getMultiInput(oParam, oValueHelpMetadata, oBindingPaths, fnOnAdvancedParameterChange);
				if (bValueHelpMetadataDefined) {
					this._addMultiInputValueHelper(oControl, oParam, oValueHelpMetadata, fnOnAdvancedParameterChange);
				}
			} else {
				if (this._canUseSelectInput(oValueHelpMetadata, bValueHelpMetadataDefined)) {
					oControl = this._getSelectInput(oParam, oBindingPaths, fnOnAdvancedParameterChange, oValueHelpMetadata);
				} else {
					oControl = this._getInput(oParam, oBindingPaths, fnOnAdvancedParameterChange);
					if (bValueHelpMetadataDefined) {
						this._addInputValueHelper(oControl, oParam, oValueHelpMetadata, fnOnAdvancedParameterChange);
					} else {
						if (oParam.IsMandatory) {
							this._addMandatoryValidationToInput(oControl, oParam, fnOnAdvancedParameterChange);
						}
					}
				}
			}

			return oControl;
		},

		_addMandatoryValidationToInput: function (oControl, oParam, fnOnAdvancedParameterChange) {
			oControl.applySettings({
				change: function(oEvent) {
					var sValue = oEvent.getParameter("value");
					var sEventType = sValue ? mAdvancedParameterEvents.ValidationSuccess : mAdvancedParameterEvents.ValidationError;

					oControl.setValueState(sValue ? ValueState.None : ValueState.Error);

					fnOnAdvancedParameterChange(new Event(sEventType, oControl, {
						label: oParam.Caption
					}));
				}
			});
		},

		_getBooleanControl: function(oParam, oBindingPaths, fnOnAdvancedParameterChange) {
			var oControl;

			if (oParam.RadioGroup) {
				oControl = new RadioButton(oParam.Id, {
					editable: !oParam.IsReadOnly,
					text: oParam.Caption,
					groupName: oParam.RadioGroup,
					select: fnOnAdvancedParameterChange
				});
			} else {
				oControl = new CheckBox(oParam.Id, {
					editable: !oParam.IsReadOnly,
					text: oParam.Caption,
					select: fnOnAdvancedParameterChange
				});
			}

			oControl.bindProperty("selected", oBindingPaths.Value);

			return oControl;
		},

		_getDateControl: function(oParam, oBindingPaths, fnOnAdvancedParameterChange) {
			return new DatePicker(oParam.Id, {
				editable: !oParam.IsReadOnly,
				required: oParam.IsMandatory,
				value: {
					path: oBindingPaths.Value
				},
				valueState: {
					path: oBindingPaths.ValueState
				},
				valueStateText: {
					path: oBindingPaths.ValueStateText
				},
				change: fnOnAdvancedParameterChange
			});
		},

		_getSelectInput: function (oParam, oBindingPaths, fnOnAdvancedParameterChange, oValueHelpMetadata) {
			var sFormattedOutputKey = "{" + oValueHelpMetadata.outputKey + "}";
			var sFormattedAdditionalTextKey = oValueHelpMetadata.outputKeyTextPath ? "{" + oValueHelpMetadata.outputKeyTextPath + "}" : undefined;
			return new Select(oParam.Id, {
				selectedKey: "{" + oBindingPaths.Value + "}",
				enabled: !oParam.IsReadOnly,
				showSecondaryValues: true,
				items: {
					path: "/" + oValueHelpMetadata.entitySet,
					template: new ListItem({
						id: "listItem-" + oParam.Id,
						key: sFormattedOutputKey,
						text: sFormattedOutputKey,
						additionalText: sFormattedAdditionalTextKey
					})
				}
			});
		},


		_getInput: function(oParam, oBindingPaths, fnOnAdvancedParameterChange) {
			var mSettings = {
				editable: !oParam.IsReadOnly,
				required: oParam.IsMandatory,
				value: {
					path: oBindingPaths.Value
				},
				valueState: {
					path: oBindingPaths.ValueState
				},
				valueStateText: {
					path: oBindingPaths.ValueStateText
				},
				maxLength:
					// This parameter is incompatible with the input type sap.m.InputType.Number.
					// If the maxLength is defined, then IntegerType validations does not work.
					oParam.Type === mAdvancedParameterTypes.Number
						? undefined
						: oParam.Length,
				change: fnOnAdvancedParameterChange
			};

			if (oParam.Type === mAdvancedParameterTypes.Number) {
				mSettings.value.type = new IntegerType(null, {
					minimum: oParam.MinValue,
					maximum: oParam.MaxValue
				});
				mSettings.type = InputType.Number;
				mSettings.change = function (oEvent) {
					var sValidationEventId = mAdvancedParameterEvents.ValidationSuccess;
					if (oEvent.getSource().getProperty("valueState") === ValueState.Error) {
						sValidationEventId = mAdvancedParameterEvents.ValidationError;
					}

					fnOnAdvancedParameterChange(new Event(sValidationEventId, oEvent.getSource(), {
						label: oParam.Caption
					}));
				};
			} else if (oParam.Length >= 100){
				mSettings["maxLength"] = oParam.Length;
				return new TextArea(oParam.Id, mSettings);
			}
			return new Input(oParam.Id, mSettings);
		},

		_addInputValueHelper: function(oControl, oParam, oValueHelpMetadata, fnOnAdvancedParameterChange) {
			var that = this;

			oControl.applySettings({
				showValueHelp: true,
				change: function(oEvent) {
					var sValue = oEvent.getParameter("value");
					that._validateInput(oControl, oValueHelpMetadata, sValue, oParam.Caption, fnOnAdvancedParameterChange);

				},
				valueHelpRequest: this.handleInputValueHelp.bind(this, oControl, oParam.Caption, oValueHelpMetadata)
			});

			return oControl;
		},


		_validateInput: function(oControl, oValueHelpMetadata, sValue, sLabel, fnOnAdvancedParameterChange) {
			var oValueHelp = this._getInputValueHelpHandler(oControl, sLabel, oValueHelpMetadata);

			oValueHelp
				.validate(sValue, oControl.getRequired())
				.then(function(oResolve) {
					oControl.setValueState(ValueState.None);
					fnOnAdvancedParameterChange(new Event(mAdvancedParameterEvents.ValidationSuccess, oControl, {
						success: oResolve,
						label: sLabel
					}));
				}, function(oReject) {
					oControl.setValueState(ValueState.Error);
					fnOnAdvancedParameterChange(new Event(mAdvancedParameterEvents.ValidationError, oControl, {
						error: oReject,
						label: sLabel
						}));
				})
				.then(function() {
					oValueHelp.destroy();
					oControl.data("valueHelp", null);
				});
		},

		_getMultiInput: function(oParam, oValueHelpMetadata, oBindingPaths, fnOnAdvancedParameterChange) {
			var that = this;
			var oControl = new MultiInput(oParam.Id, {
				maxLength: oParam.Length,
				required: oParam.IsMandatory,
				editable: !oParam.IsReadOnly,
				valueState: {
					path: oBindingPaths.ValueState
				},
				valueStateText: {
					path: oBindingPaths.ValueStateText
				},
				tokenUpdate: function(oEvent) {
					var aTokens = [];

					fnOnAdvancedParameterChange(oEvent);

					if (oEvent.getParameters().type === "removed") {
						var aRemovedTokens = oEvent.getParameter("removedTokens");

						this.getTokens().forEach(function(oToken) {
							if (aRemovedTokens.indexOf(oToken) === -1) {
								aTokens.push(oToken);
							}
						});
					}

					that._setRangeValue(this, aTokens);
					this.getModel(mModelNames.CorrItems).refresh();
				},
				tokens: {
					path: oBindingPaths.Value,
					factory: function(sId, oContext) {
						var oParams = oContext.getProperty();
						var sTokenText = that._getFormatedRangeTokenText(oParams);
						var sKey = sTokenText;

						if (oParams.OPTION === ValueHelpRangeOperation.EQ) {
							sKey = sKey.substring(1);
						}

						var oToken = new Token({
							customData :  [new CustomData({
								key : "sap-ui-custom-settings",
								value : {
									"sap.ui.dt" : {
										"designtime": "not-adaptable"
									}
								}
							})],
							text: sTokenText,
							key: sKey
						});

						oToken.data("range", {
							exclude: (oParams.SIGN === mRangeSigns.Exclude),
							operation: oParams.OPTION,
							value1: oParams.LOW,
							value2: oParams.HIGH,
							keyField: oControl.getId()
						});

						return oToken;
					}
				}
			});

			return oControl;
		},

		_addMultiInputValueHelper: function(oControl, oParam, oValueHelpMetadata, fnOnAdvancedParameterChange) {
			var that = this;
			oControl.applySettings({
				showValueHelp: true,
				change: function(oEvent) {
					var oValueHelp = that._getMultiInputValueHelpHandler(oControl, oParam.Caption, oValueHelpMetadata);
					var sValue = oEvent.getParameter("value");

					oValueHelp
						.validate(sValue)
						.then(function(oResolve) {
							oControl.setValueState(ValueState.None);
							fnOnAdvancedParameterChange(new Event(mAdvancedParameterEvents.ValidationSuccess, oControl, {
								success: oResolve,
								label: oParam.Caption
							}));

							if (!sValue) {
								return;
							}

							var oToken = that._createTokenFromText(sValue);
							var aTokens = oControl.getTokens();

							aTokens.push(oToken);
							oControl.setValue("");
							that._setRangeValue(oControl, aTokens);

						}, function(oReject) {
							oControl.setValueState(ValueState.Error);
							fnOnAdvancedParameterChange(new Event(mAdvancedParameterEvents.ValidationError, oControl, {
								error: oReject,
								label: oParam.Caption
							}));
						});
				},
				valueHelpRequest: this.handleMultiInputValueHelp.bind(this, oControl, oParam.Caption, oValueHelpMetadata)
			});
		},

		handleInputValueHelp: function(oControl, sLabel, oValueHelpMetadata) {
			var oValueHelp = this._getInputValueHelpHandler(oControl, sLabel, oValueHelpMetadata);

			oValueHelp.handleValueHelp();
		},

		handleMultiInputValueHelp: function(oMultiInput, sLabel, oValueHelpMetadata) {
			var oValueHelp = this._getMultiInputValueHelpHandler(oMultiInput, sLabel, oValueHelpMetadata);

			oValueHelp.handleValueHelp();
		},

		_getMultiInputValueHelpHandler: function(oMultiInput, sLabel, oValueHelpMetadata) {
			var that = this;

			var aTokens = oMultiInput.getTokens().map(function(oToken) {
				return new Token({
					customData :  [new CustomData({
						key : "sap-ui-custom-settings",
						value : {
							"sap.ui.dt" : {
								"designtime": "not-adaptable"
							}
						}
					})],
					key: oToken.getText(),
					text: oToken.getText()
				});
			});

			return this._getValueHelpHandler(oMultiInput, {
				supportMultiselect: true,
				supportRanges: true,
				supportRangesOnly: false,
				title: sLabel,
				ok: function(oEvent) {
					var aTokens = oEvent.getParameters().tokens;
					oMultiInput.fireTokenUpdate();
					that._setRangeValue(oMultiInput, aTokens);
				},
				afterClose: function() {
					oMultiInput.data("valueHelp", null);
				},
				rangeKeyFields: [
					{
						key: oMultiInput.getId(),
						label: sLabel
					}
				],
				tokens: aTokens,
				metadataParameters: oValueHelpMetadata.parameters,
				metadataParametersOutputKey: oValueHelpMetadata.outputKey,
				entitySet: oValueHelpMetadata.entitySet
			});
		},

		_getInputValueHelpHandler: function(oInput, sLabel, oValueHelpMetadata) {
			return this._getValueHelpHandler(oInput, {
				supportMultiselect: false,
				supportRanges: false,
				supportRangesOnly: false,
				title: sLabel,
				ok: function(oEvent) {
					var aTokens = oEvent.getParameters().tokens;
					if (aTokens[0]) {
						var sValue = aTokens[0].getText();
						oInput.setValue(sValue);
						oInput.fireChange({
							value: sValue
						});
					}
				},
				afterClose: function() {
					oInput.data("valueHelp", null);
				},
				metadataParameters: oValueHelpMetadata.parameters,
				metadataParametersOutputKey: oValueHelpMetadata.outputKey,
				entitySet: oValueHelpMetadata.entitySet
			});
		},

		_getValueHelpHandler: function(oControl, mParams) {
			var defParams = {
				model: oControl.getModel(),
				advancedParameters: oControl.getBindingContext(mModelNames.CorrItems).getProperty().SelectedCorrespondence.AdvancedParameters
			};

			var oValueHelp = oControl.data("valueHelp");

			if (!oValueHelp) {
				oValueHelp = new ValueHelpHandler(
					jQuery.extend(defParams, mParams)
				);

				oControl.data("valueHelp", oValueHelp);
			}

			return oValueHelp;
		},

		_getFormatedRangeTokenText: function(oParams) {
			var sTokenText = "";
			var bExclude = oParams.SIGN === sap.ui.comp.smartfilterbar.SelectOptionSign.exclude;

			switch (oParams.OPTION) {
				case ValueHelpRangeOperation.EQ:
					sTokenText = oParams.LOW;
					break;

				case ValueHelpRangeOperation.GT:
					sTokenText = ">" + oParams.LOW;
					break;

				case ValueHelpRangeOperation.GE:
					sTokenText = ">=" + oParams.LOW;
					break;

				case ValueHelpRangeOperation.LT:
					sTokenText = "<" + oParams.LOW;
					break;

				case ValueHelpRangeOperation.LE:
					sTokenText = "<=" + oParams.LOW;
					break;

				case ValueHelpRangeOperation.Contains:
					sTokenText = "*" + oParams.LOW + "*";
					break;

				case ValueHelpRangeOperation.StartsWith:
					sTokenText = oParams.LOW + "*";
					break;

				case ValueHelpRangeOperation.EndsWith:
					sTokenText = "*" + oParams.LOW;
					break;

				case ValueHelpRangeOperation.BT:
					if (oParams.HIGH !== "") {
						sTokenText = oParams.LOW + "..." + oParams.HIGH;
						break;
					}
			}

			if (bExclude && sTokenText !== "") {
				sTokenText = "!(" + sTokenText + ")";
			}

			return sTokenText;
		},

		_setRangeValue: function(oMultiInput, aTokens) {
			var that = this;
			var oModel = oMultiInput.getModel(mModelNames.CorrItems);
			var aRangeData = [];

			aTokens.forEach(function(oToken) {
				aRangeData.push(that._getRangeDataFromToken(oToken));
			});

			oModel.setProperty(this._getRangeBindingPath(oMultiInput), aRangeData);
		},

		_createTokenFromText: function(sText) {
			var sLow = "";
			var sHigh = "";
			var bExclude = false;
			var sOperation = ValueHelpRangeOperation.EQ;
			var sValue = sText;
			var sKey = sText;

			// check exclude operation
			if ((sText.substring(0, 2) === "!(") && (sText.substring(sText.length - 1) === ")")) {
				sValue = sText.substr(2, sText.length - 3);
				bExclude = true;
			}

			if (sValue.indexOf("...") > -1) {
				// between
				sLow = sValue.substring(0, sValue.indexOf("..."));
				sHigh = sValue.substring(sValue.indexOf("...") + 3);
				sOperation = ValueHelpRangeOperation.BT;
			} else if (sValue.indexOf(">=") === 0) {
				sOperation = ValueHelpRangeOperation.GE;
				sLow = sValue.substring(2);
			} else if (sValue.indexOf(">") === 0) {
				sOperation = ValueHelpRangeOperation.GT;
				sLow = sValue.substring(1);
			} else if (sValue.indexOf("<=") === 0) {
				sOperation = ValueHelpRangeOperation.LE;
				sLow = sValue.substring(2);
			} else if (sValue.indexOf("<") === 0) {
				sOperation = ValueHelpRangeOperation.LT;
				sLow = sValue.substring(1);
			} else if (sValue[0] === "*" && sValue[sValue.length - 1] === "*") {
				sOperation = ValueHelpRangeOperation.Contains;
				sLow = sValue.substring(1, sValue.length - 1);
			} else if (sValue[0] === "*") {
				sOperation = ValueHelpRangeOperation.StartsWith;
				sLow = sValue.substring(1);
			} else if (sValue[sValue.length - 1] === "*") {
				sOperation = ValueHelpRangeOperation.EndsWith;
				sLow = sValue.substring(0, sValue.length - 1);
			} else if (sValue.indexOf("=") === 0) {
				sKey = sValue.substring(1);
				sLow = sValue;
			} else {
				sLow = sValue;
			}

			return new Token({
				customData :  [new CustomData({
					key : "sap-ui-custom-settings",
					value : {
						"sap.ui.dt" : {
							"designtime": "not-adaptable"
						}
					}
				})],
				key: sKey,
				text: sValue
			}).data("range", {
				exclude: bExclude,
				operation: sOperation,
				value1: sLow,
				value2: sHigh
			});
		},

		_getRangeDataFromToken: function(oToken) {
			var oTokenData = oToken.data("range");

			if (typeof oTokenData === "object") {
				if (oTokenData !== null) {
					return {
						LOW: oTokenData.value1,
						HIGH: oTokenData.value2,
						OPTION: oTokenData.operation,
						SIGN: (oTokenData.exclude) ? mRangeSigns.Exclude : mRangeSigns.Include,
						Text: oToken.getText()
					};
				} else {
					return {
						LOW: oToken.getText(),
						HIGH: undefined,
						OPTION: ValueHelpRangeOperation.EQ,
						SIGN: mRangeSigns.Include,
						Text: oToken.getText()
					};
				}
			} else {
				return {
					LOW: undefined,
					HIGH: undefined,
					OPTION: undefined,
					SIGN: undefined,
					Text: undefined
				};
			}
		},

		_getRangeBindingPath: function(oMultiInput) {
			var sBindingPath = oMultiInput.getBindingPath("tokens");
			return oMultiInput.getBindingContext(mModelNames.CorrItems).getPath(sBindingPath);
		},

		/**
		 * Validates advanced parameters, sets errors and returns messages?
		 *
		 * @param {Array} aGroups advanced parameters of the currently selected correspondence type object
		 * @param {string} sErrorRequired required error text
		 * @param {string} sGenericError generic error text
		 *
		 * @returns {Array} aMessages that contains title, subtitle and key
		 */
		validate: function(aGroups, sErrorRequired, sGenericError) {
			var that = this;
			var aMessages = [];
			var oMessage;

			aGroups.forEach(function(oGroup) {
				oGroup.ParameterSet.forEach(function(oParam) {
					oMessage = that._validateParameter(oParam, sErrorRequired, sGenericError);

					if (oMessage) {
						aMessages.push(oMessage);
					}
				});
			});

			return aMessages;
		},

		_validateParameter: function(oParam, sErrorRequired, sGenericError) {
			var oMessage;

			// if already in error state, only copy the error message
			if (oParam.ValueState === ValueState.Error) {
				oMessage = {
					title: oParam.Caption,
					subtitle: oParam.ValueStateText ? oParam.ValueStateText : sGenericError,
					key: oParam.Id
				};
			} else if (oParam.IsMandatory && !oParam.Value) {
				oParam.ValueState = ValueState.Error;
				oParam.ValueStateText = sErrorRequired;

				oMessage = {
					title: oParam.Caption,
					subtitle: sErrorRequired,
					key: oParam.Id
				};
			} else {
				oParam.ValueState = ValueState.None;
			}

			return oMessage;
		},

		_getOutputAdvancedParameterValue: function(oParam) {
			var sValue = oParam.Value;
			if (!oParam.IsRange) {
				return sValue;
			}

			return JSON.stringify(
				oParam.Value.map(function(oValue) {
					return {
						HIGH: oValue.HIGH,
						LOW: oValue.LOW,
						OPTION: oValue.OPTION,
						SIGN: oValue.SIGN
					};
				})
			);
		}
	};
});
