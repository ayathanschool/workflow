import React from 'react';
import ModernFeeCollection from '../components/FeeCollection/ModernFeeCollection';
import * as api from '../api';

const FeeCollectionView = ({ user }) => {
  return <ModernFeeCollection user={user} apiBaseUrl={api.getBaseUrl()} />;
};

export default FeeCollectionView;
