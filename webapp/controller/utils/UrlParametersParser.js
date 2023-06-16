/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"./Mappings",
	"./ModelUtils"
], function(Mappings, ModelUtils) {
	"use strict";

	var mAccountTypes = Mappings.AccountTypes;
	var mAccountTypeIndices = Mappings.AccountTypeIndices;
	var mGlobalSettingsProperties = Mappings.GlobalSettingsProperties;
	var mGlobalSettingsThatHidesShare = Mappings.GlobalSettingsThatHidesShare;
	var mRegularPatterns = Mappings.RegularPatterns;
	var mUrlParameters = Mappings.UrlParameters;
	var DateFormat = sap.ui.core.format.DateFormat.getDateInstance({
		pattern: "yyyyMMdd",
		UTC: true
	});

	return {
		parseNavigation: function(oUrlParams) {
			if (typeof oUrlParams !== "object") {
				return null;
			}

			var oParameters;
			try {
				oParameters = oUrlParams.params[0];
				oParameters = JSON.parse(oParameters);
			} catch (e) {
				 return this.getLaunchpadParameters(oUrlParams);
			}
			return oParameters;
		},

		getLaunchpadParameters: function(oUrlParameters) {
			if(this.getDefaultValue(oUrlParameters.DownloadXML)){
				return {
					Settings:{
						DownloadXML: true
					}
				};
			}
			
			var oDefault = {};
			oDefault.CompanyCode = this.getDefaultValue(oUrlParameters.CompanyCode);

			oDefault.CustomerNumber = this.getCustomerNavigationValue(oUrlParameters);
			oDefault.VendorNumber = this.getVendorNavigationValue(oUrlParameters);
			oDefault.FiscalYear = this.getDefaultValue(oUrlParameters.FiscalYear);
			oDefault.DocumentNumber = this.getDefaultValue(oUrlParameters.DocumentNumber);

			if (oUrlParameters.AccountNumber && oUrlParameters.AccountNumber[0] && oUrlParameters.AccountType)

				if (oDefault.CustomerNumber) {
					oDefault.AccountType = mAccountTypes.Customer;
				} else if (oDefault.VendorNumber) {
					oDefault.AccountType = mAccountTypes.Vendor;
				}			
			
			if (this.hasDefinedProperty(oDefault)){
				return {
					Correspondences: [
						oDefault
					],
					FLP: true
				};
			}
			return null;
		},

		getCustomerNavigationValue: function(oUrlParameters) {
			var sAccountValue = this.getDefaultValue(oUrlParameters.Customer);

			if (!sAccountValue && oUrlParameters.AccountType && oUrlParameters.AccountNumber) {
				if (oUrlParameters.AccountType[0] === mUrlParameters.AccountTypeCustomer) {
					sAccountValue = oUrlParameters.AccountNumber[0];
				}
			}

			return sAccountValue;
		},

		getVendorNavigationValue: function(oUrlParameters) {
			var sAccountValue = this.getDefaultValue(oUrlParameters.Supplier);

			if (!sAccountValue && oUrlParameters.AccountType && oUrlParameters.AccountNumber) {
				if (oUrlParameters.AccountType[0] === mUrlParameters.AccountTypeVendor) {
					sAccountValue = oUrlParameters.AccountNumber[0];
				}
			}

			return sAccountValue;
		},

		hasDefinedProperty: function(oParameters) {
			return Object.keys(oParameters)
				.reduce(function(bValid, sKey) {
					return bValid || typeof oParameters[sKey] !== "undefined";
				}, false);
		},

		getDefaultValue: function(aProperty) {
			return (jQuery.isArray(aProperty)) ? aProperty[0] : undefined;
		},

		mergeGlobalSettings: function(oUrlSettings, oGlobalSettings) {
			if (typeof oUrlSettings !== "object") {
				return oGlobalSettings;
			}

			var oNewSettings = jQuery.extend(true, {}, oGlobalSettings);
			oNewSettings.Share = this.getShare(oUrlSettings);

			Object.keys(oNewSettings).forEach(function(sSetting) {
				if (oUrlSettings.hasOwnProperty(sSetting) && oNewSettings[sSetting] !== false) {
					oNewSettings[sSetting] = oUrlSettings[sSetting];
				}
			});

			return oNewSettings;
		},

		getShare: function(oSettings) {
			var aSettings = Object.keys(oSettings);
			var bShare = true;

			for (var i = 0; i < aSettings.length; i++) {
				var sSettingKey = aSettings[i];
				var bSettingValue = oSettings[sSettingKey];
				if (this.shouldHideShare(sSettingKey, bSettingValue)) {
					bShare = false;
					break;
				}
			}

			return bShare;
		},

		shouldHideShare: function(sSetting, bSettingValue) {
			var aGlobalSettingsKeys = Object.keys(mGlobalSettingsThatHidesShare);
			return (!bSettingValue && jQuery.inArray(sSetting, aGlobalSettingsKeys) > -1) ||
				sSetting === mGlobalSettingsProperties.ApplicationTitle;
		},

		getValue: function(sKey) {
			var aValue = this.oSelectionVariant.getSelectOption(sKey);
			if (aValue) {
				return aValue[0].Low;
			}

			return "";
		},

		getEmailData: function(oData, oDefaultParameters) {
			var oEmailData = {};

			if (typeof oDefaultParameters !== "object") {
				oDefaultParameters = {}; // eslint-disable-line no-param-reassign
			}

			var oMergeData = jQuery.extend(true, {}, oDefaultParameters, oData);

			if (oMergeData.EmailSubject) {
				oEmailData.EmailSubject = oMergeData.EmailSubject;
			}
			if (oMergeData.EmailTemplate) {
				oEmailData.TemplateKey = oMergeData.EmailTemplate;
			}
			if (oMergeData.EmailAddress) {
				oEmailData.Emails = this._getTokens(oMergeData.EmailAddress);
			}
			if (oMergeData.EmailAddressFallback) {
				oEmailData.FallbackEmails = this._getTokens(oMergeData.EmailAddressFallback);
			}

			return oEmailData;
		},


		parseDate: function(sDate) {
			if (sDate && sDate.length === 8) {
				return DateFormat.parse(sDate);
			}

			return null;
		},

		getCorrespondenceData: function(oCorrespondenceData) {
			if (typeof oCorrespondenceData !== "object") {
				oCorrespondenceData = {}; 	// eslint-disable-line no-param-reassign
			}

			if (typeof oCorrespondenceData.DefaultParameters !== "object") {
				oCorrespondenceData.DefaultParameters = {};
			}

			var iId = oCorrespondenceData.BasicFields.Id;
			var oDefaultData = ModelUtils.getDefaultCorrItemObject(iId);
			var oMergeData = jQuery.extend(true, {}, oCorrespondenceData.DefaultParameters, oCorrespondenceData.BasicFields);

			oDefaultData.Id = iId;
			oDefaultData.Title = oMergeData.Title;

			var oBasicFields = oDefaultData.BasicFields;
			Object.keys(oBasicFields).forEach(function(sKey) {
				oBasicFields[sKey] = oMergeData[sKey] || oBasicFields[sKey];
			});

			if (oBasicFields.CustomerNumber) {
				oBasicFields.AccountType = mAccountTypes.Customer;
			} else if (oBasicFields.VendorNumber) {
				oBasicFields.AccountType = mAccountTypes.Vendor;
				oDefaultData.State.AccountTypeIndex = mAccountTypeIndices.Vendor;
			} else {
				oBasicFields.AccountType = mAccountTypes.None;
			}

			if (typeof oBasicFields.Date1 === "string") {
				oBasicFields.Date1 = this.parseDate(oBasicFields.Date1);
			}

			if (typeof oBasicFields.Date2 === "string") {
				oBasicFields.Date2 = this.parseDate(oBasicFields.Date2);
			}

			if (oMergeData.CompanyCode) {
				oDefaultData.Editable.CorrespondenceType = true;
			}

			if (typeof oCorrespondenceData.Editable === "object") {
				Object.keys(oDefaultData.Editable).forEach(function(sKey) {
					if (typeof oCorrespondenceData.Editable[sKey] === "boolean") {
						oDefaultData.Editable[sKey] = oCorrespondenceData.Editable[sKey];
					}
				});
			}

			return oDefaultData;
		},

		getOverviewFields: function(oOverviewFields) {
			var oDefaultFields = ModelUtils.getDefaultOverviewFields();

			if (typeof oOverviewFields !== "object") {
				return oDefaultFields;
			}

			Object.keys(oDefaultFields).forEach(function(sKey) {
				if (typeof oOverviewFields[sKey] === "boolean") {
					oDefaultFields[sKey] = oOverviewFields[sKey];
				}
			});

			return oDefaultFields;
		},
		
		mergeAdvancedParameters: function(oAdvancedParameters, oDefaultAdvancedParameters){
			if (!oAdvancedParameters) {
				oAdvancedParameters = {}; // eslint-disable-line no-param-reassign
			}
			oAdvancedParameters = jQuery.extend(true, oDefaultAdvancedParameters, oAdvancedParameters); // eslint-disable-line no-param-reassign
			return oAdvancedParameters;
		},

		/**
		 * Sets visible data specified by selected correspondence item
		 * @param {object} oData Data that will be used as a new correspondence item
		 * @param {object} oCorrespondence selected correspondence item
		 * @param {boolean} oCorrespondence.RequiresAccountNumber whether account number field should be visible
		 * @param {boolean} oCorrespondence.RequiresDocument whether FiscalYear and DocumentNumber fields should be visible
		 * @param {int} oCorrespondence.NumberOfDates how many date fields should be visible
		 * @param {string} oCorrespondence.Date1Text date1 field label
		 * @param {string} oCorrespondence.Date2Text date2 field label
		 *
		 * @returns {*} oData with set visible data
		 */
		getVisibleData: function(oData, oCorrespondence) {
			var sAccountType = oData.BasicFields.AccountType;
			if (sAccountType) {
				oData.Visible.AccountType = true;
				if (sAccountType === mAccountTypes.Customer && oCorrespondence.RequiresAccountNumber) {
					oData.Visible.CustomerNumber = true;
				} else if (sAccountType === mAccountTypes.Vendor && oCorrespondence.RequiresAccountNumber) {
					oData.Visible.VendorNumber = true;
				}
			}

			oData.Visible.Date1 = (oCorrespondence.NumberOfDates > 0);
			oData.Visible.Date2 = (oCorrespondence.NumberOfDates > 1);
			oData.Visible.FiscalYear = oCorrespondence.RequiresDocument;
			oData.Visible.DocumentNumber = oCorrespondence.RequiresDocument;

			return oData;
		},

		/**
		 * Splits string of emails into array of tokens
		 * @param {string} sValues string of email addresses separated by comma, semicolon or space
		 * @returns {Array} array of tokens
		 * @private
		 */
		_getTokens: function(sValues) {
			var aTokens = [];
			var aValues = sValues.split(mRegularPatterns.Separators);

			// remove duplicates
			aValues = aValues.filter(function(sItem, iIndex) {
				return aValues.indexOf(sItem) === iIndex;
			});


			aValues.forEach(function(sValue) {
				if (mRegularPatterns.Email.test(sValue)) {
					aTokens.push({
						email: sValue
					});
				}
			});

			return aTokens;
		}
	};
});

