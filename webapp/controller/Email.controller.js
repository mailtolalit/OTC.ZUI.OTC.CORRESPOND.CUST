/*
 * Copyright (C) 2009-2022 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/Fragment",
	"fin/ar/correspondence/create/v2/controller/Dialog.controller",
	"./utils/ModelUtils",
	"./utils/DateFormat",
	"sap/ui/core/ValueState",
	"sap/ui/core/MessageType",
	"./utils/Mappings",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(Fragment, DialogController, ModelUtils, DateFormat, ValueState, MessageType, Mappings, MessageBox, Filter, FilterOperator) { //eslint-disable-line max-params
	"use strict";

	var mCorrItemsProperties = Mappings.CorrItemsProperties;
	var mEmailProperties = Mappings.EmailDialogProperties;
	var mEmailTypes = Mappings.EmailTypes;
	var mEntitySets = Mappings.EntitySets;
	var mEntityTypes = Mappings.EntityTypes;
	var mEntityTypesProperties = Mappings.EntityTypesProperties;
	var mExternalActions = Mappings.ExternalActions;
	var mFunctionImports = Mappings.FunctionImports;
	var mIds = Mappings.Ids;
	var mMessagePopoverKeys = Mappings.MessagePopoverKeys;
	var mMessagePopoverGroups = Mappings.MessagePopoverGroups;
	var mModelNames = Mappings.ModelNames;
	var mModelPropertyTypes = Mappings.ModelPropertyTypes;
	var mRegularPatterns = Mappings.RegularPatterns;


	var EmailController = DialogController.extend("fin.ar.correspondence.create.v2.controller.Email", {
		Id: mIds.EmailDialog,

		constructor: function(sIdSuffix) {
			DialogController.apply(this, arguments);
			if (sIdSuffix) {
				this.Id += sIdSuffix;
			}
		},

		initDialog: function(oOptions) {
			var that = this;

			DialogController.prototype.initDialog.call(this, oOptions);

			this._oEmailContent = Fragment.byId(this.Id, mIds.EmailContent);
			this._oEmailto = Fragment.byId(this.Id, mIds.EmailEmailto);
			this._oEmailSubject = Fragment.byId(this.Id, mIds.EmailSubject);
			this._oEmailTemplate = Fragment.byId(this.Id, mIds.EmailTemplate);

			this._bWasLastEventPaste = false;
			this._oEmailto.addEventDelegate({
				onpaste: function(oEvent) {
					that._bWasLastEventPaste = true;
				}
			});
		},

		/**
		 * Tries to tokenize all emails in this._Emailto, breaks on first incorrect email and sets appropriate error
		 *
		 * @private
		 */
		_splitAndTokenizeEmailtoValue: function() {
			var that = this,
				sEmailtoValue = this._oEmailto.getValue(),
				sEmail = "";

			// try to tokenize every email separated with separator
			while (sEmailtoValue) {
				sEmail = sEmailtoValue.split(mRegularPatterns.Separators, 1)[0];

				if (sEmail) {
					if (!this._isTokenazibleEmail(sEmail)) {
						this._oEmailto.setValue(sEmail);
						this._validateEmailto();
						break;
					}

					this._oEmailto.setValue(sEmail);
					this._validateEmailto();
				}

				// remove used part from sEmailtoValue
				sEmailtoValue = sEmailtoValue.substring(sEmail.length + 1);
			}

			// put back rest of sEmailtoValue that has not been tokenized
			// setTimeout 0 because MultiInput sets value of this._oEmailto to the pasted value (on paste)
			setTimeout(function() {
				that._oEmailto.setValue(sEmailtoValue);
			}, 0);
		},


		/**
		 * Test if email string is valid email address
		 *
		 * @param {string} sEmail email string
		 *
		 * @returns {boolean} true if email string is valid, false otherwise
		 */
		isValidEmail: function(sEmail) {
			return mRegularPatterns.Email.test(sEmail);
		},


		/**
		 * Test if email string is both valid email and is not yet added into emailTo tokens
		 *
		 * @param {string} sEmail email string
		 *
		 * @returns {bool} true if email string is both valid email and is not yet added into this._oEmailto tokens
		 * @private
		 */
		_isTokenazibleEmail: function(sEmail) {
			return this.isValidEmail(sEmail) && !this.isInTokens(sEmail, this._oEmailto.getTokens());
		},

		_validate: function(oContext) {
			var bValid = this._validateEmailto(oContext);

			if (this._isNewOM()) {
				bValid = this._validateTemplate(oContext) && bValid;
			}

			return bValid;
		},

		_validateEmailto: function(oContext) {
			var bValid = this._validateEmailtoInputValue(oContext);
			var sEmailtoKey = mMessagePopoverKeys.Emailto;
			var sEmailLabel = this._oController._getLabelForProperty(sEmailtoKey, mEntityTypes.Email);

			if (bValid) {
				if (this._getEmailProperty(mCorrItemsProperties.Emails, oContext).length > 0) {
					this._setEmailProperty(mCorrItemsProperties.EmailToState, ValueState.None, oContext);
					this._oController.removePopoverMessages(sEmailtoKey, oContext);
					bValid = true;
				} else {
					var sErrorMessage = this._oController.translateText("INPUT_REQUIRED_ERROR");
					this._setEmailProperty(mCorrItemsProperties.EmailToStateText, sErrorMessage, oContext);
					this._setEmailProperty(mCorrItemsProperties.EmailToState, ValueState.Error, oContext);
					this._oController.updatePopoverMessagesModel({
						title: sEmailLabel,
						subtitle: sErrorMessage,
						key: sEmailtoKey,
						group: mMessagePopoverGroups.Email
					}, oContext);
					bValid = false;
				}
			}

			return bValid;
		},


		/**
		 * Validates input value for Email address. This function is called when we are trying to tokenize rest of the email string.
		 *
		 * @param {object} oBindingContext corrItems model context
		 * @returns {boolean} true if input is valid, false otherwise
		 * @private
		 */
		_validateEmailtoInputValue: function(oBindingContext) {
			var bValid = false;

			var sEmailtoValue = this._getEmailProperty(mCorrItemsProperties.EmailTo, oBindingContext);
			var sErrorMessage;
			var sEmailtoKey = mMessagePopoverKeys.Emailto;
			var sEmailtoLabel = this._oController._getLabelForProperty(sEmailtoKey, mEntityTypes.Email);

			if (!sEmailtoValue) {
				bValid = true;
			} else if (this.isInTokens(sEmailtoValue, this._oEmailto.getTokens())) {
				sErrorMessage = this._oController.translateText("WARNING_SAME_EMAIL");
				this._setEmailProperty(mCorrItemsProperties.EmailToStateText, sErrorMessage, oBindingContext);
				this._setEmailProperty(mCorrItemsProperties.EmailToState, ValueState.Warning, oBindingContext);

				this._oController.updatePopoverMessagesModel({
					title: sEmailtoLabel,
					subtitle: sErrorMessage,
					key: sEmailtoKey,
					type: MessageType.Warning,
					group: mMessagePopoverGroups.Email
				});

			} else if (this.isValidEmail(sEmailtoValue)) {
				// no need to remove popover message here, because it will be removed during next validation
				this._getEmailProperty(mCorrItemsProperties.Emails).push({
					email: sEmailtoValue
				});
				this._oEmailto.setValue("");
				this._getCorrItemsModel().refresh(true);

				bValid = true;
			} else {
				sErrorMessage = this._oController.translateText("EMAIL_FORMAT_ERROR");
				this._setEmailProperty(mCorrItemsProperties.EmailToStateText, sErrorMessage, oBindingContext);
				this._setEmailProperty(mCorrItemsProperties.EmailToState, ValueState.Error, oBindingContext);

				this._oController.updatePopoverMessagesModel({
					title: sEmailtoLabel,
					subtitle: sErrorMessage,
					key: sEmailtoKey,
					group: mMessagePopoverGroups.Email
				});
			}

			return bValid;
		},

		onEmailtoChange: function() {
			this._splitAndTokenizeEmailtoValue();
			this._validateEmailto();
		},

		onEmailTokenChange: function(oEvent) {
			if (oEvent.getParameter("type") === "removed") {
				var aEmails = this._getEmailProperty(mCorrItemsProperties.Emails);

				aEmails.splice(aEmails.indexOf(aEmails.find(function(oEmail) {
					return oEmail.email === oEvent.getParameter("removedTokens")[0].getKey();
				})), 1);
				this._getCorrItemsModel().refresh(true);
			}

			this._validateEmailto();
		},

		onEmail: function() {
			var that = this;

			this.trimFields(this._oEmailto);

			if (this._validate()) {
				var oContext = this._oController.getActiveBindingContext();
				var oData = this.getEmailData(oContext);

				this.sendSingleRequest(oData, "EMAILSUCCESS").then(function() {
					that._oController._setCorrespondenceStatus(mCorrItemsProperties.EmailSent, true);
				});
			}
		},

		getEmailData: function(oContext) {
			var oEmailData = this._oController.getInputData(oContext);
			oEmailData.Email = {
				Subject: this._getEmailProperty(mCorrItemsProperties.EmailSubject, oContext),
				To: this.getRecipients(oContext)
			};

			if (this._isNewOM(oContext)) {
				oEmailData.Email.MailTemplateId = this._getEmailProperty(mCorrItemsProperties.TemplateKey, oContext);
			} else {
				oEmailData.Email.Content = this._getEmailProperty(mCorrItemsProperties.EmailContent, oContext);
			}

			return oEmailData;
		},

		_isNewOM: function(oContext) {
			var sEmailType = this._oController.getCorrItemsModelProperty(mModelPropertyTypes.EmailType, oContext);
			return sEmailType === mEmailTypes.EmailNewOm;
		},

		getRecipients: function(oContext) {
			var sRecipients = "";
			var aRecipients = this._getEmailProperty(mCorrItemsProperties.Emails, oContext);

			aRecipients.forEach(function(oRecipient, idx) {
				sRecipients += oRecipient.email;
				if (idx !== (aRecipients.length - 1)) {
					sRecipients += Mappings.ValueSeparators.Email;
				}
			});

			return sRecipients;
		},

		showMassEmailDialog: function(sDescription, aEmailEnabled) {
			var bCompact = !!this._oController.getView().$().closest(".sapUiSizeCompact").length;

			MessageBox.show(sDescription, {
					title: this._oController.translateText("MULTIPLE_EMAIL_TITLE"),
					icon: MessageBox.Icon.WARNING,
					styleClass: bCompact ? "sapUiSizeCompact" : "",
					actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
					initialFocus: MessageBox.Action.OK,
					onClose: this.onEmailDialogConfirmation.bind(this, aEmailEnabled)
				}
			);
		},

		onEmailDialogConfirmation: function(aCorrItems, oAction) {
			var that = this;

			if (oAction === MessageBox.Action.OK) {
				this._oController.setBusy();

				this.sendMassEmail(aCorrItems).then(function() {
					that._oController.setNotBusy();
				});
			}
		},

		sendMassEmail: function(aCorrItems) {
			var that = this;
			var aData = [];

			aCorrItems.forEach(function(oCorrItem) {
				var oContext = oCorrItem.getBindingContext(mModelNames.CorrItems);

				aData.push(this.getEmailData(oContext));
			}, this);

			return this.sendMassRequest(aData, aCorrItems, "EMAILSUCCESS", mExternalActions.MassEmail)
				.then(function(aResponseData) {
					that._setEmailStatus(aCorrItems, aResponseData);

					return aResponseData;
				});
		},

		_setEmailStatus: function(aCorrItems, aResponseData) {
			this._setCorrStatus(aCorrItems, aResponseData, mCorrItemsProperties.EmailSent);
		},

		onEmailDialogCloseButton: function() {
			this.closeDialog();
		},

		onEmailValueHelpRequest: function(oEvent) {
			var sPath = this._oController.getCorrItemsModelContextBindingPath() + "/" + ModelUtils.getEmailPropertyPath(mCorrItemsProperties.Emails),
				mParams = {
					sEntitySet: mEmailProperties.ValueHelpEmailsSet,
					sEntityType: mEmailProperties.EmailEntityType,
					aColumnFields: [mEmailProperties.EmailAddress, mEmailProperties.CorrespncEmailSourceTypeText, mEmailProperties.CorrespncAddrShortWthStrText], 
					aFilterFields: [],
					sMainKey: mEmailProperties.EmailAddress,
					oResultField: this._oEmailto,
					bSupportMultiselect: true,
					oBinding: {sModel: mModelNames.CorrItems, sProperty: sPath, sResultProperty: "email"},
					bDoNotGenerateBasicSearch: true,
					bShowGoButton: false,
					oInput: oEvent.getSource()
				};
			this.onValueHelpRequest(mParams);
		},

		onEmailtoLiveChange: function(oEvent) {
			var sEmail = this._oEmailto.getValue(),
				aSplitted;

			// try to tokenize if this event is caused by onpaste
			if (this._bWasLastEventPaste) {
				this._bWasLastEventPaste = false;
				this._splitAndTokenizeEmailtoValue();
			} else if (mRegularPatterns.Separators.test(sEmail.slice(-1))) {
				aSplitted = sEmail.split(mRegularPatterns.Separators);
				// tokenize email if there is only one email string and last character is separator
				if (aSplitted.length === 2 && this.isValidEmail(aSplitted[0])) {
					this._splitAndTokenizeEmailtoValue();
				}
			}
		},

		_resetModels: function(oOptions, oContext) {
			var oEmailInvalidation = oOptions.emailInvalidation;
			var oDefaultData = oOptions.defaultData;

			this._setEmailProperty(mCorrItemsProperties.EmailLanguage, oDefaultData.EmailLanguage, oContext);
			this._setEmailProperty(mCorrItemsProperties.CompanyCode, oDefaultData.CompanyCode, oContext);
			this._setEmailProperty(mCorrItemsProperties.ClerkSourceType, oDefaultData.ClerkSourceType, oContext);

			if (oEmailInvalidation.invalidateEmailSubject) {
				this._setDefaultSubject(oDefaultData, oContext);
			}

			if (oEmailInvalidation.invalidateEmailTo) {
				this._setDefaultEmailTo(oDefaultData, oContext);
			}

			if (oEmailInvalidation.invalidateSenderAddress) {
				this._setDefaultSenderAddress(oDefaultData, oContext);
			}

			if (oEmailInvalidation.invalidateEmailTemplate) {
				this._setDefaultEmailTemplate(oContext);
			} else if (oEmailInvalidation.invalidateEmailTemplatePreview) {
				this.getAndRenderPreview(oContext);
			}

		},

		_setDefaultSubject: function(oDefaultData, oContext) {
			var sDefaultSubject = this._getDefaultSubject(oDefaultData.EmailSubject, oContext);
			this._setEmailProperty(mCorrItemsProperties.EmailSubject, sDefaultSubject, oContext);
			this._setEmailProperty(mCorrItemsProperties.InvalidateEmailSubject, false, oContext);
			this._setEmailProperty(mCorrItemsProperties.SubjectChanged, false, oContext);
		},

		_setDefaultEmailTo: function(oDefaultData, oContext) {
			var aEmails = [];
			var sBusinessPartner = "";
			if (oDefaultData) {
				if (oDefaultData.EmailAddress) {
					oDefaultData.EmailAddress.split(Mappings.ValueSeparators.Email).forEach(function(sEmail) {
						aEmails.push({
							email: sEmail
						});
					});
				}

				if (oDefaultData.BusinessPartner) {
					sBusinessPartner = oDefaultData.BusinessPartner;
				}
			}

			if (aEmails.length === 0 && jQuery.isArray(oDefaultData.FallbackEmails)) {
				aEmails = oDefaultData.FallbackEmails.slice(); // clone array
			}

			this._setEmailProperty(mCorrItemsProperties.Emails, aEmails, oContext);
			this._setEmailProperty(mCorrItemsProperties.BusinessPartner, sBusinessPartner, oContext);
			this._setEmailProperty(mCorrItemsProperties.EmailToState, ValueState.None, oContext);
			this._setEmailProperty(mCorrItemsProperties.InvalidateEmailTo, false, oContext);
		},

		_setDefaultSenderAddress: function(oDefaultData, oContext) {
			this._setEmailProperty(mCorrItemsProperties.SenderAddress, oDefaultData.SenderAddress, oContext);
			this._setEmailProperty(mCorrItemsProperties.InvalidateSenderAddress, false, oContext);
		},

		_setDefaultEmailTemplate: function(oContext) {
			this._setEmailProperty(mCorrItemsProperties.TemplateKey, "", oContext);
			this._setEmailProperty(mCorrItemsProperties.Template, "", oContext);
			this._setEmailProperty(mCorrItemsProperties.TemplateState, ValueState.None, oContext);
			this.loadAndRenderTemplates(oContext);
			this._setEmailProperty(mCorrItemsProperties.InvalidateEmailTemplate, false, oContext);
		},

		loadAndRenderTemplates: function(oContext) {
			var that = this;

			return new Promise(function(resolve, reject) {
				if (that._isNewOM(oContext)) {
					that._getTemplates().then(function(aTemplates) {
						// Combobox event SelectionChange is triggered before user finishes the input and that triggers
						// rendering of the template preview. That's why we are using Change event that is not triggered
						// when user change template with same name. So to trigger Change event to start rendering of the
						// template preview, we need to have only unique template names
						var aFixedTemplates = that._ReplaceEmptyTemplateNames(aTemplates);
						var aUniqueTemplates = that._modifyDuplicates(aFixedTemplates.sort(function(oTemplate1, oTemplate2) {
							var sName1 = oTemplate1.Name.toLowerCase(),
								sName2 = oTemplate2.Name.toLowerCase();

							if (sName1 < sName2) {
								return -1;
							} else if (sName1 > sName2) {
								return 1;
							}
							return 0;
						}));

						that._setEmailProperty(mCorrItemsProperties.Templates, aUniqueTemplates, oContext);

						resolve();
					}, function() {
						resolve();
					});

					that._setEmailProperty(mCorrItemsProperties.HtmlContent, "", oContext);
				} else {
					resolve();
				}
			});
		},

		setData: function(oOptions, oContext) {
			var oEmailInvalidation = this.getEmailInvalidationObject(oContext);
			if (this._shouldInvalidate(oEmailInvalidation)) {
				oOptions.emailInvalidation = oEmailInvalidation;
				this._resetModels(oOptions, oContext);
			}

			var bIsNewOM = this._isNewOM(oContext);
			this._setControls(bIsNewOM, oContext);

			if (bIsNewOM && this._oDialog.setInitialFocus && oContext === this._oController.getActiveBindingContext()) {
				if (this._getEmailProperty(mCorrItemsProperties.Emails).length > 0) {
					// change focus to template if there is some default emailto and isOnCloudEventOM
					this._oDialog.setInitialFocus(this._oEmailTemplate);
				} else {
					this._oDialog.setInitialFocus(this._oEmailto);
				}
			}
		},

		/**
		 * Object describing what should be invalidate in email form.
		 * @typedef {Object} EmailInvalidation
		 * @property {boolean} invalidateEmailSubject invalidate subject
		 * @property {boolean} invalidateEmailTemplate invalidate template
		 * @property {boolean} invalidateEmailTemplatePreview invalidate template preview
		 * @property {boolean} invalidateEmailTo invalidate recipient
		 * @property {boolean} invalidateSenderAddress invalidate sender
		 */

		/**
		 * Checks if there should be something invalidate in email form
		 * @param {EmailInvalidation} oInvalidate information about the invalidation
		 * @returns {boolean} true if the email form should invalidate at least something, otherwise false
		 * @private
		 */
		_shouldInvalidate: function(oInvalidate) {
			return oInvalidate.invalidateEmailSubject ||
				oInvalidate.invalidateEmailTemplate ||
				oInvalidate.invalidateEmailTemplatePreview ||
				oInvalidate.invalidateEmailTo ||
				oInvalidate.invalidateSenderAddress;
		},

		/**
		 * Returns object describing what fields should be invalidated
		 * @param {Object} oContext binding context
		 * @returns {EmailInvalidation} object describing what fields should be invalidated
		 */
		getEmailInvalidationObject: function(oContext) {
			var oEmailData = oContext.getProperty(mModelPropertyTypes.Email);

			return {
				invalidateEmailSubject: oEmailData.InvalidateEmailSubject,
				invalidateEmailTemplate: oEmailData.InvalidateEmailTemplate,
				invalidateEmailTemplatePreview: oEmailData.InvalidateEmailTemplatePreview,
				invalidateEmailTo: oEmailData.InvalidateEmailTo,
				invalidateSenderAddress: oEmailData.InvalidateSenderAddress
			};
		},

		setControls: function(oContext) {
			this._setControls(this._isNewOM(oContext), oContext);
		},

		/**
		 * For templates without name, uses their id as new name
		 * @param {array} aTemplates array of Email Templates
		 *
		 * @private
		 * @returns {array} Array of templates without empty names
		 */
		_ReplaceEmptyTemplateNames: function(aTemplates) {
			aTemplates.forEach(function(oTemplate) {
				if (oTemplate.Name.trim() === "") {
					oTemplate.Name = oTemplate.MailTemplateId;
				}
			});
			return aTemplates;
		},

		/**
		 * Modifies duplicate Email Templates by adding corresponding number of spaces to the end of the element
		 * @param {array} aTemplates sorted array of Email Templates
		 *
		 * @private
		 * @returns {array} Array of templates without duplicates
		 */
		_modifyDuplicates: function(aTemplates) {
			var iLastIndex = 0,
				iIndex;

			function fnAddSpaces(sString, iCount) {
				return sString + (new Array(iCount + 1)).join(" ");
			}

			for (iIndex = 1; iIndex < aTemplates.length; iIndex++) {
				if (aTemplates[iLastIndex].Name.trim() !== aTemplates[iIndex].Name) {
					iLastIndex = iIndex;
				} else {
					aTemplates[iIndex].Name = fnAddSpaces(aTemplates[iIndex].Name, iIndex - iLastIndex + 1);

					// we need to add space for the first occurrence as well
					if ((iIndex - iLastIndex) === 1) {
						aTemplates[iLastIndex].Name = fnAddSpaces(aTemplates[iLastIndex].Name, 1);
					}
				}
			}

			return aTemplates;
		},

		_setControls: function(bIsOnCloudNewOM, oContext) {
			this._setEmailProperty(mCorrItemsProperties.EmailTemplateVisible, bIsOnCloudNewOM, oContext);
			this._setEmailProperty(mCorrItemsProperties.EmailContentVisible, !bIsOnCloudNewOM, oContext);
			this._setEmailProperty(mCorrItemsProperties.TemplateContentVisible, bIsOnCloudNewOM, oContext);
		},

		/**
		 * Returns empty string for OP and name of the current Correspondence Type for CE
		 *
		 * @param {string}[sEmailSubject] subject of an email
		 * @param {object} oContext corrItems model context
		 * @returns {string} Default email subject
		 * @private
		 */
		_getDefaultSubject: function(sEmailSubject, oContext) {
			if (sEmailSubject) {
				return sEmailSubject;
			}

			var sCorrespondencePath = ModelUtils.getSelectedCorrespondencePath(mCorrItemsProperties.Name);

			return this._oController.getCorrItemsModelProperty(sCorrespondencePath, oContext);
		},

		_getTemplates: function() {
			var that = this;

			var oContext = this._oController.getActiveBindingContext();
			this._setEmailProperty(mCorrItemsProperties.TemplateBusy, true, oContext);

			var sGetTemplatesUrl = this._getTemplatesUrl();

			return new Promise(function(resolve, reject) {
				that._oModel.read(sGetTemplatesUrl, {
					filters: [
						new Filter({
							path: mCorrItemsProperties.Language,
							operator: FilterOperator.EQ,
							value1: that._getEmailProperty(mCorrItemsProperties.EmailLanguage, oContext)
						})
					],
					success: function(oData, response) {
						that._setEmailProperty(mCorrItemsProperties.TemplateBusy, false, oContext);
						resolve(oData.results ? oData.results : {});
					},
					error: function(oData, response) {
						that._setEmailProperty(mCorrItemsProperties.TemplateBusy, false, oContext);
						reject(oData);
					}
				});
			});
		},

		_getTemplatesUrl: function() {
			var sCorrType = this._oModel.createKey(mEntitySets.CorrTypeSet, {
				Event: this._oController.getCorrItemsSelectedCorrespondenceField(mCorrItemsProperties.Event),
				VariantId: this._oController.getCorrItemsSelectedCorrespondenceField(mCorrItemsProperties.Variant),
				Id: this._oController.getCorrItemsSelectedCorrespondenceField(mCorrItemsProperties.Id)
			});

			return "/" + sCorrType + "/" + mEntitySets.EmailTemplateSet;
		},

		onTemplateChanged: function() {
			var that = this;
			var oContext = this._oEmailTemplate.getBindingContext(mModelNames.CorrItems);
			var bValid = this._validateTemplate(oContext);

			// remove trailing spaces
			this._oEmailTemplate.setValue(this._oEmailTemplate.getValue().trim());

			that._setEmailProperty(mCorrItemsProperties.HtmlContent, "", oContext);
			that._setEmailProperty(mCorrItemsProperties.TemplateContentVisible, false, oContext);
			that._setEmailProperty(mCorrItemsProperties.SubjectChanged, false, oContext);

			if (bValid) {
				this.getAndRenderPreview(oContext);
			}
		},

		onSubjectChanged: function() {
			var oContext = this._oEmailTemplate.getBindingContext(mModelNames.CorrItems);

			this._setEmailProperty(mCorrItemsProperties.SubjectChanged, true, oContext);
		},

		getAndRenderPreview: function(oContext) {
			var that = this;

			if (!this._getEmailProperty(mCorrItemsProperties.TemplateKey, oContext)) {
				return Promise.resolve();
			}

			return this.getPreview(oContext).then(function(oResults) {
				var sProperty;
				var sContent;

				that._setEmailProperty(mCorrItemsProperties.TemplateContentVisible, true, oContext);

				if (oResults.Preview_html) {
					sContent = "<div>" + oResults.Preview_html + "</div>";
					sProperty = mEntityTypesProperties.PreviewHtml;
				} else {
					sContent = "<div style='white-space: pre-wrap;'>" + oResults.Preview_txt + "</div>";
					sProperty = mEntityTypesProperties.PreviewTxt;
				}

				that._setEmailProperty(mCorrItemsProperties.HtmlContent, sContent, oContext);
				var selectedTemplate = that._getSelectedEmailTemplate(oContext);
				that._setEmailProperty(mCorrItemsProperties.Template, selectedTemplate.Name, oContext);

				if (!that._getEmailProperty(mCorrItemsProperties.SubjectChanged, oContext)) {
					var sEmailSubject = that._getDefaultSubject(oResults.Subject, oContext);
					that._setEmailProperty(mCorrItemsProperties.EmailSubject, sEmailSubject, oContext);
				}
			});
		},

		/**
		 * Validates template field and sets error if the field input is not correct
		 *
		 * @param {object} [oContext] Binding context
		 * @private
		 * @returns {boolean} true if template is correctly set, false otherwise
		 */
		_validateTemplate: function(oContext) {
			var sEmailTemplateKey = mMessagePopoverKeys.EmailTemplate;
			var bValid = this._isTemplateValid(oContext);
			var sErrorText = this._getEmailProperty(mCorrItemsProperties.TemplateStateText, oContext);

			if (bValid) {
				this._oController.removePopoverMessages(sEmailTemplateKey, oContext);
			} else {
				var sEmailTemplateLabel = this._oController._getLabelForProperty(sEmailTemplateKey, mEntityTypes.Email);

				this._oController.updatePopoverMessagesModel({
					title: sEmailTemplateLabel,
					subtitle: this._oController.translateText(sErrorText),
					key: sEmailTemplateKey,
					group: mMessagePopoverGroups.Email
				}, oContext);
			}

			return bValid;
		},

		/**
		 * Validates email temaplte in combobox
		 *
		 * @param {object} oContext context for corrItemsModel
		 *
		 * @returns {boolean} True if input is correct, false otherwise
		 */
		_isTemplateValid: function(oContext) {
			var sErrorText = this._oController.translateText("EMAIL_TEMPLATE_COMBOBOX_ERROR");
			var bValid = !!this._getEmailProperty(mCorrItemsProperties.TemplateKey, oContext);
			var sValue = this._getEmailProperty(mCorrItemsProperties.Template, oContext);

			if (!sValue) {
				sErrorText = this._oController.translateText("INPUT_REQUIRED_ERROR");
			}

			if (!bValid) {
				this._setEmailProperty(mCorrItemsProperties.TemplateStateText, sErrorText, oContext);
			}
			var sValueState = (bValid) ? ValueState.None : ValueState.Error;
			this._setEmailProperty(mCorrItemsProperties.TemplateState, sValueState, oContext);

			return bValid;
		},

		getPreview: function(oContext) {
			var that = this;
			var oRenderData = this._getRenderTemplateInputData(oContext);

			this._setEmailProperty(mCorrItemsProperties.EmailBusy, true, oContext);

			return new Promise(function(resolve, reject) {
				that._oModel.callFunction(mFunctionImports.RenderTemplate, {
					urlParameters: oRenderData,
					async: true,
					success: function(oData, oResponse) {
						that._setEmailProperty(mCorrItemsProperties.EmailBusy, false, oContext);
						resolve(oData.results ? oData.results[0] : oData);
					},
					error: function(oData, oResponse) {
						that._setEmailProperty(mCorrItemsProperties.EmailBusy, false, oContext);
						reject(oData);
					}
				});
			});
		},

		_getRenderTemplateInputData: function(oContext) {
			var oInputData = this._oController.getInputData(oContext);
			oInputData.Date1 = DateFormat.dateToAbapTimestamp(oInputData.Date1);
			oInputData.Date2 = DateFormat.dateToAbapTimestamp(oInputData.Date2);
			var oDefaultData = ModelUtils.getBasicRenderTemplateObject();
			var oTemplate = this._getSelectedEmailTemplate(oContext);
			var oEmailData = {
				MailTemplateId: oTemplate.MailTemplateId,
				Language: oTemplate.Language
			};

			return jQuery.extend({}, oDefaultData, oInputData, oEmailData);
		},

		_getSelectedEmailTemplate: function(oContext) {
			var sTemplateKey = this._getEmailProperty(mCorrItemsProperties.TemplateKey, oContext);
			var aTemplates = this._getEmailProperty(mCorrItemsProperties.Templates, oContext);

			for (var i = 0; i < aTemplates.length; i++) {
				if (aTemplates[i].MailTemplateId === sTemplateKey) {
					return aTemplates[i];
				}
			}
		},

		_getCorrItemsModel: function() {
			if (!this._oCorrItemsModel) {
				this._oCorrItemsModel = this._oController.getView().getModel(mModelNames.CorrItems);
			}

			return this._oCorrItemsModel;
		},

		_getEmailProperty: function(sProperty, oBindingContext) {
			return this._oController.getCorrItemsModelProperty(ModelUtils.getEmailPropertyPath(sProperty), oBindingContext);
		},

		_setEmailProperty: function(sProperty, vValue, oBindingContext) {
			return this._oController.setCorrItemsModelProperty(ModelUtils.getEmailPropertyPath(sProperty), vValue, oBindingContext);
		}

	});

	return EmailController;
});

