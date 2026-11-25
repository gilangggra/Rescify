import { Router } from 'express';
import {
  createDispatch,
  deleteDispatch,
  getAllDispatches,
  getDispatchById,
  updateDispatch,
} from '../controllers/dispatchesController';

const router = Router();

router.get('/', getAllDispatches);
router.get('/:id', getDispatchById);
router.post('/', createDispatch);
router.put('/:id', updateDispatch);
router.delete('/:id', deleteDispatch);

export default router;
